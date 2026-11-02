const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const orderItemColumns = "order_id, book_id, quantity, total, createdAt, updatedAt";
const insertedOrderItemColumns = "INSERTED.order_id, INSERTED.book_id, INSERTED.quantity, INSERTED.total, INSERTED.createdAt, INSERTED.updatedAt";

function handleOrderItemWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Cuốn sách này đã tồn tại trong chi tiết đơn hàng.", 409, error);
    }
    if (error && error.number === 547) {
        throw new AppError("Ràng buộc chi tiết đơn hàng không hợp lệ (đơn hàng hoặc cuốn sách không tồn tại).", 400, error);
    }
    throw error;
}

async function create({ orderId, bookId, quantity, total }, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const req = new sql.Request(executor);
        const result = await req
            .input("order_id", sql.Char(36), orderId)
            .input("book_id", sql.Int, Number(bookId))
            .input("quantity", sql.Int, Math.max(1, Number(quantity) || 1))
            .input("total", sql.Int, Math.max(0, Number(total) || 0))
            .query(`INSERT INTO dbo.order_details (order_id, book_id, quantity, total, createdAt, updatedAt)
                    OUTPUT ${insertedOrderItemColumns}
                    VALUES (@order_id, @book_id, @quantity, @total, GETDATE(), GETDATE())`);
        return result.recordset[0];
    } catch (error) {
        handleOrderItemWriteError(error);
    }
}

async function createMany(orderId, items = [], transaction = null) {
    if (!Array.isArray(items)) return [];

    const consolidatedMap = new Map();
    for (const item of items) {
        const bookId = Number(item.bookId || item.book_id || item.id);
        if (!Number.isInteger(bookId) || bookId <= 0) continue;
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const total = Math.max(0, Number(item.total) || 0);

        if (consolidatedMap.has(bookId)) {
            const existing = consolidatedMap.get(bookId);
            existing.quantity += quantity;
            existing.total += total;
        } else {
            consolidatedMap.set(bookId, { orderId, bookId, quantity, total });
        }
    }

    const createdItems = [];
    for (const item of consolidatedMap.values()) {
        const created = await create(item, transaction);
        createdItems.push(created);
    }
    return createdItems;
}

async function findByOrderId(orderId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("order_id", sql.Char(36), orderId)
        .query(`SELECT 
                    od.order_id,
                    od.book_id,
                    od.quantity,
                    od.total,
                    od.createdAt,
                    od.updatedAt,
                    b.title,
                    b.author,
                    b.price,
                    b.image,
                    b.discount AS book_discount
                FROM dbo.order_details od
                LEFT JOIN dbo.books b ON od.book_id = b.id
                WHERE od.order_id = @order_id
                ORDER BY od.createdAt ASC`);
    return result.recordset;
}

async function findByOrderIdAndBookId(orderId, bookId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("order_id", sql.Char(36), orderId)
        .input("book_id", sql.Int, Number(bookId))
        .query(`SELECT ${orderItemColumns}
                FROM dbo.order_details
                WHERE order_id = @order_id AND book_id = @book_id`);
    return result.recordset[0] || null;
}

async function deleteByOrderId(orderId, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;
    const req = new sql.Request(executor);
    const result = await req
        .input("order_id", sql.Char(36), orderId)
        .query("DELETE FROM dbo.order_details WHERE order_id = @order_id");
    return result.rowsAffected[0];
}

async function findByOrderIds(orderIds = []) {
    if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
    const pool = await connectDB();
    const req = pool.request();
    const paramNames = orderIds.map((id, index) => {
        const pName = `orderId_${index}`;
        req.input(pName, sql.Char(36), id);
        return `@${pName}`;
    });
    const result = await req.query(`SELECT 
                                        od.order_id,
                                        od.book_id,
                                        od.quantity,
                                        od.total,
                                        od.createdAt,
                                        od.updatedAt,
                                        b.title,
                                        b.author,
                                        b.price,
                                        b.image,
                                        b.discount AS book_discount
                                    FROM dbo.order_details od
                                    LEFT JOIN dbo.books b ON od.book_id = b.id
                                    WHERE od.order_id IN (${paramNames.join(",")})
                                    ORDER BY od.createdAt ASC`);
    return result.recordset;
}

module.exports = {
    create,
    createMany,
    findByOrderId,
    findByOrderIds,
    findByOrderIdAndBookId,
    deleteByOrderId,
    handleOrderItemWriteError
};

