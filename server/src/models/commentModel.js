const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const commentColumns = "c.id, c.user_id, c.book_id, c.rate, c.value, c.isDelete, c.createdAt, c.updatedAt";
const insertedCommentColumns = "INSERTED.id, INSERTED.user_id, INSERTED.book_id, INSERTED.rate, INSERTED.value, INSERTED.isDelete, INSERTED.createdAt, INSERTED.updatedAt";

function handleCommentWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Bạn đã có bài đánh giá cho cuốn sách này rồi.", 409, error);
    }
    throw error;
}

async function create({ userId, bookId, rate = null, value = null }, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const parsedRate = rate !== null && rate !== undefined ? Number(rate) : null;

    const req = new sql.Request(executor)
        .input("user_id", sql.Char(36), userId)
        .input("book_id", sql.Int, Number(bookId))
        .input("rate", sql.Int, parsedRate)
        .input("value", sql.NVarChar(1000), value);

    const query = `
        INSERT INTO dbo.comments (user_id, book_id, rate, value, isDelete, createdAt, updatedAt)
        OUTPUT ${insertedCommentColumns}
        VALUES (@user_id, @book_id, @rate, @value, 0, SYSUTCDATETIME(), SYSUTCDATETIME())
    `;

    try {
        const result = await req.query(query);
        return result.recordset[0];
    } catch (error) {
        handleCommentWriteError(error);
    }
}

async function findById(id, { includeDeleted = false } = {}) {
    const pool = await connectDB();
    let query = `
        SELECT ${commentColumns}, 
               u.full_name AS user_full_name, 
               u.username AS user_username, 
               u.avatar AS user_avatar,
               b.title AS book_title
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.books b ON c.book_id = b.id
        WHERE c.id = @id
    `;
    if (!includeDeleted) {
        query += " AND c.isDelete = 0";
    }

    const result = await pool.request()
        .input("id", sql.Int, Number(id))
        .query(query);

    return result.recordset[0] || null;
}

async function findUserReview(userId, bookId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("user_id", sql.Char(36), userId)
        .input("book_id", sql.Int, Number(bookId))
        .query(`SELECT TOP 1 ${commentColumns} FROM dbo.comments c WHERE c.user_id = @user_id AND c.book_id = @book_id AND c.isDelete = 0 AND c.rate IS NOT NULL`);
    return result.recordset[0] || null;
}

async function findByBookId(bookId, { page = 1, limit = 10, includeDeleted = false, type = "all" } = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    let whereClause = "WHERE c.book_id = @book_id";
    if (!includeDeleted) {
        whereClause += " AND c.isDelete = 0";
    }
    if (type === "reviews") {
        whereClause += " AND c.rate IS NOT NULL";
    } else if (type === "discussions") {
        whereClause += " AND c.rate IS NULL";
    }

    const countReq = new sql.Request(pool).input("book_id", sql.Int, Number(bookId));
    const listReq = new sql.Request(pool)
        .input("book_id", sql.Int, Number(bookId))
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit);

    const countQuery = `SELECT COUNT(1) AS total FROM dbo.comments c ${whereClause}`;
    const listQuery = `
        SELECT ${commentColumns}, 
               u.full_name AS user_full_name, 
               u.username AS user_username, 
               u.avatar AS user_avatar
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        ${whereClause}
        ORDER BY c.createdAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const [countRes, listRes] = await Promise.all([
        countReq.query(countQuery),
        listReq.query(listQuery)
    ]);

    const total = countRes.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
        comments: listRes.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages
    };
}

async function getBookRatingSummary(bookId) {
    const pool = await connectDB();
    const query = `
        SELECT 
            COUNT(rate) AS totalReviews,
            COUNT(CASE WHEN rate IS NULL THEN 1 END) AS totalDiscussions,
            CAST(ROUND(COALESCE(AVG(CAST(rate AS FLOAT)), 0), 1) AS FLOAT) AS avgRating,
            SUM(CASE WHEN rate = 5 THEN 1 ELSE 0 END) AS count5Star,
            SUM(CASE WHEN rate = 4 THEN 1 ELSE 0 END) AS count4Star,
            SUM(CASE WHEN rate = 3 THEN 1 ELSE 0 END) AS count3Star,
            SUM(CASE WHEN rate = 2 THEN 1 ELSE 0 END) AS count2Star,
            SUM(CASE WHEN rate = 1 THEN 1 ELSE 0 END) AS count1Star
        FROM dbo.comments
        WHERE book_id = @book_id AND isDelete = 0
    `;

    const result = await new sql.Request(pool)
        .input("book_id", sql.Int, Number(bookId))
        .query(query);

    const row = result.recordset[0] || {};
    const distribution = {
        5: row.count5Star || 0,
        4: row.count4Star || 0,
        3: row.count3Star || 0,
        2: row.count2Star || 0,
        1: row.count1Star || 0
    };
    return {
        totalReviews: row.totalReviews || 0,
        totalDiscussions: row.totalDiscussions || 0,
        avgRating: row.avgRating || 0,
        averageRate: row.avgRating || 0,
        distribution,
        breakdown: distribution
    };
}

async function update(id, userId, { rate = undefined, value = undefined }, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const sets = ["updatedAt = SYSUTCDATETIME()"];
    const req = new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .input("user_id", sql.Char(36), userId);

    if (rate !== undefined) {
        sets.push("rate = @rate");
        req.input("rate", sql.Int, rate !== null ? Number(rate) : null);
    }

    if (value !== undefined) {
        sets.push("value = @value");
        req.input("value", sql.NVarChar(1000), value);
    }

    const query = `
        UPDATE dbo.comments
        SET ${sets.join(", ")}
        OUTPUT ${insertedCommentColumns}
        WHERE id = @id AND user_id = @user_id AND isDelete = 0
    `;

    try {
        const result = await req.query(query);
        return result.recordset[0] || null;
    } catch (error) {
        handleCommentWriteError(error);
    }
}

async function changeStatus(id, isDelete, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;
    const targetFlag = isDelete ? 1 : 0;
    const currentStatus = targetFlag === 1 ? 0 : 1;

    const query = `
        UPDATE dbo.comments
        SET isDelete = @targetFlag, updatedAt = SYSUTCDATETIME()
        OUTPUT ${insertedCommentColumns}
        WHERE id = @id AND isDelete = @currentStatus
    `;

    const result = await new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .input("targetFlag", sql.TinyInt, targetFlag)
        .input("currentStatus", sql.TinyInt, currentStatus)
        .query(query);

    return result.recordset[0] || null;
}

async function findAllAdmin({ page = 1, limit = 10, bookId = null, rate = null, isDelete = null, search = null } = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    const whereClauses = [];
    const countReq = new sql.Request(pool);
    const listReq = new sql.Request(pool)
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit);

    if (bookId) {
        whereClauses.push("c.book_id = @book_id");
        countReq.input("book_id", sql.Int, Number(bookId));
        listReq.input("book_id", sql.Int, Number(bookId));
    }

    if (rate !== null && rate !== undefined && rate !== "") {
        whereClauses.push("c.rate = @rate");
        countReq.input("rate", sql.Int, Number(rate));
        listReq.input("rate", sql.Int, Number(rate));
    }

    if (isDelete !== null && isDelete !== undefined && isDelete !== "") {
        whereClauses.push("c.isDelete = @isDelete");
        countReq.input("isDelete", sql.TinyInt, Number(isDelete));
        listReq.input("isDelete", sql.TinyInt, Number(isDelete));
    }

    if (search && search.trim()) {
        whereClauses.push("(c.value LIKE @search OR u.full_name LIKE @search OR u.username LIKE @search OR b.title LIKE @search)");
        const searchPattern = `%${search.trim()}%`;
        countReq.input("search", sql.NVarChar(255), searchPattern);
        listReq.input("search", sql.NVarChar(255), searchPattern);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countQuery = `
        SELECT COUNT(1) AS total 
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.books b ON c.book_id = b.id
        ${whereSql}
    `;

    const listQuery = `
        SELECT ${commentColumns}, 
               u.full_name AS user_full_name, 
               u.username AS user_username, 
               u.avatar AS user_avatar,
               b.title AS book_title
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.books b ON c.book_id = b.id
        ${whereSql}
        ORDER BY c.createdAt DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const [countRes, listRes] = await Promise.all([
        countReq.query(countQuery),
        listReq.query(listQuery)
    ]);

    const total = countRes.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;

    return {
        comments: listRes.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages
    };
}

module.exports = {
    create,
    findById,
    findUserReview,
    findByBookId,
    getBookRatingSummary,
    update,
    changeStatus,
    findAllAdmin
};
