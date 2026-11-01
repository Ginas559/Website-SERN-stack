const { v4: uuidv4 } = require("uuid");
const { sql, connectDB } = require("../config/connectDB");

const cartColumns = "id, user_id, total, total_quantity, discount_id, createdAt, updatedAt";
const insertedCartColumns = "INSERTED.id, INSERTED.user_id, INSERTED.total, INSERTED.total_quantity, INSERTED.discount_id, INSERTED.createdAt, INSERTED.updatedAt";

async function findByUserId(userId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("user_id", sql.Char(36), userId)
        .query(`SELECT ${cartColumns} FROM dbo.carts WHERE user_id = @user_id`);
    return result.recordset[0] || null;
}

async function createCart(userId) {
    const pool = await connectDB();
    const cartId = uuidv4();
    const result = await pool.request()
        .input("id", sql.Char(36), cartId)
        .input("user_id", sql.Char(36), userId)
        .query(`INSERT INTO dbo.carts (id, user_id, total, total_quantity, discount_id, createdAt, updatedAt)
                OUTPUT ${insertedCartColumns}
                VALUES (@id, @user_id, 0, 0, NULL, GETDATE(), GETDATE())`);
    return result.recordset[0];
}

async function getOrCreateCart(userId) {
    const existing = await findByUserId(userId);
    if (existing) return existing;
    return await createCart(userId);
}

async function getCartDetails(cartId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("cart_id", sql.Char(36), cartId)
        .query(`SELECT 
                    cd.cart_id,
                    cd.book_id,
                    cd.quantity,
                    cd.total,
                    cd.createdAt,
                    cd.updatedAt,
                    b.title,
                    b.author,
                    b.price,
                    b.image,
                    b.discount,
                    b.quantity AS stock_quantity,
                    b.isDelete AS book_is_deleted
                FROM dbo.cart_details cd
                LEFT JOIN dbo.books b ON cd.book_id = b.id
                WHERE cd.cart_id = @cart_id
                ORDER BY cd.createdAt DESC`);
    return result.recordset;
}

async function findDetail(cartId, bookId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("cart_id", sql.Char(36), cartId)
        .input("book_id", sql.Int, bookId)
        .query(`SELECT cart_id, book_id, quantity, total, createdAt, updatedAt
                FROM dbo.cart_details
                WHERE cart_id = @cart_id AND book_id = @book_id`);
    return result.recordset[0] || null;
}

async function saveItemAndSync({ cartId, bookId, quantity, total }) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const checkReq = new sql.Request(transaction);
        const existingResult = await checkReq
            .input("cart_id", sql.Char(36), cartId)
            .input("book_id", sql.Int, bookId)
            .query("SELECT cart_id, book_id FROM dbo.cart_details WHERE cart_id = @cart_id AND book_id = @book_id");

        const writeReq = new sql.Request(transaction);
        writeReq
            .input("cart_id", sql.Char(36), cartId)
            .input("book_id", sql.Int, bookId)
            .input("quantity", sql.Int, quantity)
            .input("total", sql.Int, total);

        if (existingResult.recordset[0]) {
            await writeReq.query(`UPDATE dbo.cart_details
                                  SET quantity = @quantity, total = @total, updatedAt = GETDATE()
                                  WHERE cart_id = @cart_id AND book_id = @book_id`);
        } else {
            await writeReq.query(`INSERT INTO dbo.cart_details (cart_id, book_id, quantity, total, createdAt, updatedAt)
                                  VALUES (@cart_id, @book_id, @quantity, @total, GETDATE(), GETDATE())`);
        }

        const syncReq = new sql.Request(transaction);
        const syncResult = await syncReq
            .input("cart_id", sql.Char(36), cartId)
            .query(`UPDATE dbo.carts
                    SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        updatedAt = GETDATE()
                    OUTPUT ${insertedCartColumns}
                    WHERE id = @cart_id`);

        await transaction.commit();
        return syncResult.recordset[0] || null;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function removeItemAndSync(cartId, bookId) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const deleteReq = new sql.Request(transaction);
        await deleteReq
            .input("cart_id", sql.Char(36), cartId)
            .input("book_id", sql.Int, bookId)
            .query("DELETE FROM dbo.cart_details WHERE cart_id = @cart_id AND book_id = @book_id");

        const syncReq = new sql.Request(transaction);
        const syncResult = await syncReq
            .input("cart_id", sql.Char(36), cartId)
            .query(`UPDATE dbo.carts
                    SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        updatedAt = GETDATE()
                    OUTPUT ${insertedCartColumns}
                    WHERE id = @cart_id`);

        await transaction.commit();
        return syncResult.recordset[0] || null;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function clearCartAndSync(cartId) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const deleteReq = new sql.Request(transaction);
        await deleteReq
            .input("cart_id", sql.Char(36), cartId)
            .query("DELETE FROM dbo.cart_details WHERE cart_id = @cart_id");

        const syncReq = new sql.Request(transaction);
        const syncResult = await syncReq
            .input("cart_id", sql.Char(36), cartId)
            .query(`UPDATE dbo.carts
                    SET total = 0,
                        total_quantity = 0,
                        updatedAt = GETDATE()
                    OUTPUT ${insertedCartColumns}
                    WHERE id = @cart_id`);

        await transaction.commit();
        return syncResult.recordset[0] || null;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function syncTotals(cartId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("cart_id", sql.Char(36), cartId)
        .query(`UPDATE dbo.carts
                SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                    total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                    updatedAt = GETDATE()
                OUTPUT ${insertedCartColumns}
                WHERE id = @cart_id`);
    return result.recordset[0] || null;
}

module.exports = {
    findByUserId,
    createCart,
    getOrCreateCart,
    getCartDetails,
    findDetail,
    saveItemAndSync,
    removeItemAndSync,
    clearCartAndSync,
    syncTotals,
};
