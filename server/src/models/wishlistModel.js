const { sql, connectDB } = require("../config/connectDB");

const wishlistColumns = "id, user_id, createdAt, updatedAt";
const insertedWishlistColumns = "INSERTED.id, INSERTED.user_id, INSERTED.createdAt, INSERTED.updatedAt";

async function findByUserId(userId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("user_id", sql.Char(36), userId)
        .query(`SELECT ${wishlistColumns} FROM dbo.wishlists WHERE user_id = @user_id`);
    return result.recordset[0] || null;
}

async function createWishlist(userId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("user_id", sql.Char(36), userId)
        .query(`INSERT INTO dbo.wishlists (user_id)
                OUTPUT ${insertedWishlistColumns}
                VALUES (@user_id)`);
    return result.recordset[0];
}

async function getOrCreateWishlist(userId) {
    const existing = await findByUserId(userId);
    if (existing) return existing;
    try {
        return await createWishlist(userId);
    } catch (error) {
        if (error && (error.number === 2601 || error.number === 2627)) {
            return await findByUserId(userId);
        }
        throw error;
    }
}

async function getWishlistDetails(wishlistId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("wishlist_id", sql.Int, wishlistId)
        .query(`SELECT 
                    wb.wishlist_id,
                    wb.book_id,
                    wb.createdAt AS added_at,
                    b.title,
                    b.author,
                    b.price,
                    b.image,
                    b.discount,
                    b.quantity AS stock_quantity,
                    b.isDelete AS book_is_deleted
                FROM dbo.wishlist_books wb
                LEFT JOIN dbo.books b ON wb.book_id = b.id
                WHERE wb.wishlist_id = @wishlist_id
                ORDER BY wb.createdAt DESC`);
    return result.recordset;
}

async function findBookInWishlist(wishlistId, bookId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("wishlist_id", sql.Int, wishlistId)
        .input("book_id", sql.Int, bookId)
        .query(`SELECT wishlist_id, book_id, createdAt
                FROM dbo.wishlist_books
                WHERE wishlist_id = @wishlist_id AND book_id = @book_id`);
    return result.recordset[0] || null;
}

async function addBook(wishlistId, bookId) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const checkReq = new sql.Request(transaction);
        const existing = await checkReq
            .input("wishlist_id", sql.Int, wishlistId)
            .input("book_id", sql.Int, bookId)
            .query("SELECT wishlist_id, book_id FROM dbo.wishlist_books WHERE wishlist_id = @wishlist_id AND book_id = @book_id");

        let record = existing.recordset[0] || null;

        if (!record) {
            const insertReq = new sql.Request(transaction);
            const insertResult = await insertReq
                .input("wishlist_id", sql.Int, wishlistId)
                .input("book_id", sql.Int, bookId)
                .query(`INSERT INTO dbo.wishlist_books (wishlist_id, book_id)
                        OUTPUT INSERTED.wishlist_id, INSERTED.book_id, INSERTED.createdAt
                        VALUES (@wishlist_id, @book_id)`);
            record = insertResult.recordset[0];
        }

        const touchReq = new sql.Request(transaction);
        await touchReq
            .input("wishlist_id", sql.Int, wishlistId)
            .query("UPDATE dbo.wishlists SET updatedAt = GETDATE() WHERE id = @wishlist_id");

        await transaction.commit();
        return record;
    } catch (error) {
        await transaction.rollback();
        if (error && (error.number === 2601 || error.number === 2627)) {
            return await findBookInWishlist(wishlistId, bookId);
        }
        throw error;
    }
}

async function removeBook(wishlistId, bookId) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const deleteReq = new sql.Request(transaction);
        const deleteResult = await deleteReq
            .input("wishlist_id", sql.Int, wishlistId)
            .input("book_id", sql.Int, bookId)
            .query("DELETE FROM dbo.wishlist_books WHERE wishlist_id = @wishlist_id AND book_id = @book_id");

        const touchReq = new sql.Request(transaction);
        await touchReq
            .input("wishlist_id", sql.Int, wishlistId)
            .query("UPDATE dbo.wishlists SET updatedAt = GETDATE() WHERE id = @wishlist_id");

        await transaction.commit();
        return deleteResult.rowsAffected[0] || 0;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function clearWishlist(wishlistId) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const deleteReq = new sql.Request(transaction);
        const deleteResult = await deleteReq
            .input("wishlist_id", sql.Int, wishlistId)
            .query("DELETE FROM dbo.wishlist_books WHERE wishlist_id = @wishlist_id");

        const touchReq = new sql.Request(transaction);
        await touchReq
            .input("wishlist_id", sql.Int, wishlistId)
            .query("UPDATE dbo.wishlists SET updatedAt = GETDATE() WHERE id = @wishlist_id");

        await transaction.commit();
        return deleteResult.rowsAffected[0] || 0;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    findByUserId,
    createWishlist,
    getOrCreateWishlist,
    getWishlistDetails,
    findBookInWishlist,
    addBook,
    removeBook,
    clearWishlist,
};

