const { v4: uuidv4 } = require("uuid");
const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");
const orderItemModel = require("./orderItemModel");

const orderColumns = "id, user_id, total, total_quantity, status, pay_url, discount, payment_method, ghn_info, ghn_response, ghn_code, ghn_fee, createdAt, updatedAt";
const insertedOrderColumns = "INSERTED.id, INSERTED.user_id, INSERTED.total, INSERTED.total_quantity, INSERTED.status, INSERTED.pay_url, INSERTED.discount, INSERTED.payment_method, INSERTED.ghn_info, INSERTED.ghn_response, INSERTED.ghn_code, INSERTED.ghn_fee, INSERTED.createdAt, INSERTED.updatedAt";

function handleOrderWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Mã đơn hàng đã tồn tại.", 409, error);
    }
    if (error && error.number === 547) {
        throw new AppError("Ràng buộc dữ liệu đơn hàng không hợp lệ (người dùng không tồn tại).", 400, error);
    }
    throw error;
}

async function create(orderData, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const orderId = orderData.id || uuidv4();
        const req = new sql.Request(executor);
        const result = await req
            .input("id", sql.Char(36), orderId)
            .input("user_id", sql.Char(36), orderData.userId || orderData.user_id || null)
            .input("total", sql.Int, Math.max(0, Number(orderData.total) || 0))
            .input("total_quantity", sql.Int, Math.max(0, Number(orderData.totalQuantity || orderData.total_quantity) || 0))
            .input("status", sql.Int, Number.isInteger(orderData.status) ? orderData.status : 0)
            .input("pay_url", sql.VarChar(255), orderData.payUrl || orderData.pay_url || null)
            .input("discount", sql.Int, orderData.discount !== undefined && orderData.discount !== null ? Number(orderData.discount) : null)
            .input("payment_method", sql.VarChar(50), orderData.paymentMethod || orderData.payment_method || "COD")
            .input("ghn_info", sql.NVarChar(sql.MAX), typeof orderData.ghnInfo === "object" ? JSON.stringify(orderData.ghnInfo) : (orderData.ghnInfo || null))
            .input("ghn_response", sql.NVarChar(sql.MAX), typeof orderData.ghnResponse === "object" ? JSON.stringify(orderData.ghnResponse) : (orderData.ghnResponse || null))
            .input("ghn_code", sql.VarChar(255), orderData.ghnCode || orderData.ghn_code || null)
            .input("ghn_fee", sql.Int, Math.max(0, Number(orderData.ghnFee || orderData.ghn_fee) || 0))
            .query(`INSERT INTO dbo.orders (id, user_id, total, total_quantity, status, pay_url, discount, payment_method, ghn_info, ghn_response, ghn_code, ghn_fee, createdAt, updatedAt)
                    OUTPUT ${insertedOrderColumns}
                    VALUES (@id, @user_id, @total, @total_quantity, @status, @pay_url, @discount, @payment_method, @ghn_info, @ghn_response, @ghn_code, @ghn_fee, GETDATE(), GETDATE())`);

        return result.recordset[0];
    } catch (error) {
        handleOrderWriteError(error);
    }
}

async function createWithItems(orderData, items = [], externalTransaction = null) {
    const pool = await connectDB();
    const isInternal = !externalTransaction;
    const tx = externalTransaction || new sql.Transaction(pool);

    if (isInternal) await tx.begin();

    try {
        const createdOrder = await create(orderData, tx);
        const createdItems = await orderItemModel.createMany(createdOrder.id, items, tx);

        if (isInternal) await tx.commit();
        return { ...createdOrder, items: createdItems };
    } catch (error) {
        if (isInternal) {
            try { await tx.rollback(); } catch { return; }
        }
        throw error;
    }
}

async function findById(id, { includeItems = true } = {}) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query(`SELECT ${orderColumns} FROM dbo.orders WHERE id = @id`);

    const order = result.recordset[0];
    if (!order) return null;

    let items = [];
    if (includeItems) {
        items = await orderItemModel.findByOrderId(id);
    }
    return { ...order, items };
}

async function findByUserId(userId, { page = 1, limit = 10, status = null } = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    let whereSql = "WHERE user_id = @user_id";
    if (status !== null && status !== undefined && status !== "") whereSql += " AND status = @status";

    const countReq = pool.request().input("user_id", sql.Char(36), userId);
    if (status !== null && status !== undefined && status !== "") countReq.input("status", sql.Int, Number(status));
    const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.orders ${whereSql}`);
    const total = countRes.recordset[0].total;

    const listReq = pool.request()
        .input("user_id", sql.Char(36), userId)
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit);
    if (status !== null && status !== undefined && status !== "") listReq.input("status", sql.Int, Number(status));

    const listRes = await listReq.query(`SELECT ${orderColumns} FROM dbo.orders ${whereSql}
                                         ORDER BY createdAt DESC
                                         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return { orders: listRes.recordset, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
}

async function updateStatus(id, nextStatus, expectedCurrentStatus = null) {
    const safeNext = Number(nextStatus);
    if (expectedCurrentStatus !== null && expectedCurrentStatus !== undefined && Number(expectedCurrentStatus) === safeNext) {
        return await findById(id, { includeItems: false });
    }

    const pool = await connectDB();
    let query = `UPDATE dbo.orders SET status = @nextStatus, updatedAt = GETDATE()
                 OUTPUT ${insertedOrderColumns} WHERE id = @id`;

    const req = pool.request()
        .input("id", sql.Char(36), id)
        .input("nextStatus", sql.Int, Number(nextStatus));

    if (expectedCurrentStatus !== null && expectedCurrentStatus !== undefined) {
        query += " AND status = @expectedCurrentStatus";
        req.input("expectedCurrentStatus", sql.Int, Number(expectedCurrentStatus));
    }

    const result = await req.query(query);
    const updated = result.recordset[0];
    if (!updated) {
        throw new AppError("Trạng thái đơn hàng đã thay đổi hoặc không tìm thấy đơn hàng, vui lòng thử lại.", 409);
    }
    return updated;
}

module.exports = {
    create,
    createWithItems,
    findById,
    findByUserId,
    updateStatus,
    handleOrderWriteError
};
