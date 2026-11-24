const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const commentColumns = "c.id, c.user_id, c.book_id, c.parent_id, c.rate, c.value, c.isDelete, c.createdAt, c.updatedAt";
const insertedCommentColumns = "INSERTED.id, INSERTED.user_id, INSERTED.book_id, INSERTED.parent_id, INSERTED.rate, INSERTED.value, INSERTED.isDelete, INSERTED.createdAt, INSERTED.updatedAt";

function handleCommentWriteError(
    error,
    conflictMessage = "Bạn đã có bài đánh giá cho cuốn sách này rồi."
) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError(conflictMessage, 409, error);
    }
    if (error && error.number === 547) {
        throw new AppError("Dữ liệu phản hồi không hợp lệ hoặc bình luận gốc không tồn tại.", 400, error);
    }
    throw error;
}

async function create({ userId, bookId, parentId = null, rate = null, value = null }, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const parsedParentId = parentId !== null && parentId !== undefined ? Number(parentId) : null;
    const parsedRate = parsedParentId !== null
        ? null
        : (rate !== null && rate !== undefined ? Number(rate) : null);

    const req = new sql.Request(executor)
        .input("user_id", sql.Char(36), userId)
        .input("book_id", sql.Int, Number(bookId))
        .input("parent_id", sql.Int, parsedParentId)
        .input("rate", sql.Int, parsedRate)
        .input("value", sql.NVarChar(1000), value);

    const query = `
        INSERT INTO dbo.comments (user_id, book_id, parent_id, rate, value, isDelete, createdAt, updatedAt)
        OUTPUT ${insertedCommentColumns}
        SELECT @user_id, @book_id, @parent_id, @rate, @value, 0, SYSUTCDATETIME(), SYSUTCDATETIME()
        FROM dbo.books b
        WHERE b.id = @book_id
          AND b.isDelete = 0
          AND (
              @parent_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM dbo.comments p
                  WHERE p.id = @parent_id
                    AND p.book_id = @book_id
                    AND p.isDelete = 0
                    AND p.parent_id IS NULL
                    AND (
                        p.rate IS NULL
                        OR EXISTS (
                            SELECT 1
                            FROM dbo.Users au
                            WHERE au.id = @user_id
                              AND au.isAdmin = 1
                              AND au.isDelete = 0
                        )
                    )
              )
          )
    `;

    try {
        const result = await req.query(query);
        return result.recordset[0] || null;
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
               COALESCE(u.isAdmin, 0) AS user_isAdmin,
               b.title AS book_title,
               parent_u.full_name AS parent_user_full_name,
               parent_u.username AS parent_user_username
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.books b ON c.book_id = b.id
        LEFT JOIN dbo.comments parent_c ON c.parent_id = parent_c.id
        LEFT JOIN dbo.Users parent_u ON parent_c.user_id = parent_u.id
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
        .query(`
            SELECT TOP 1 ${commentColumns},
                   u.full_name AS user_full_name,
                   u.username AS user_username,
                   u.avatar AS user_avatar,
                   COALESCE(u.isAdmin, 0) AS user_isAdmin
            FROM dbo.comments c
            LEFT JOIN dbo.Users u ON c.user_id = u.id
            WHERE c.user_id = @user_id
              AND c.book_id = @book_id
              AND c.isDelete = 0
              AND c.parent_id IS NULL
              AND c.rate IS NOT NULL
            ORDER BY c.createdAt DESC, c.id DESC
        `);
    return result.recordset[0] || null;
}

async function findRepliesByParentIds(parentIds = []) {
    const uniqueIds = [...new Set(
        (Array.isArray(parentIds) ? parentIds : [])
            .map((id) => Number(id))
            .filter((id) => Number.isInteger(id) && id > 0)
    )];
    if (uniqueIds.length === 0) {
        return [];
    }

    const pool = await connectDB();
    const req = new sql.Request(pool);
    const placeholders = uniqueIds.map((parentId, index) => {
        req.input(`p${index}`, sql.Int, parentId);
        return `@p${index}`;
    });

    const query = `
        SELECT ${commentColumns},
               u.full_name AS user_full_name,
               u.username AS user_username,
               u.avatar AS user_avatar,
               COALESCE(u.isAdmin, 0) AS user_isAdmin,
               parent_u.full_name AS parent_user_full_name,
               parent_u.username AS parent_user_username
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.comments parent_c ON c.parent_id = parent_c.id
        LEFT JOIN dbo.Users parent_u ON parent_c.user_id = parent_u.id
        WHERE c.isDelete = 0
          AND c.parent_id IN (${placeholders.join(", ")})
        ORDER BY c.createdAt ASC, c.id ASC
    `;

    const result = await req.query(query);
    return result.recordset;
}

async function executeBookReviewsList(pool, whereClause, { bookId, hasRateFilter, rate, offset, safeLimit }) {
    const listReq = new sql.Request(pool)
        .input("book_id", sql.Int, Number(bookId))
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit);

    if (hasRateFilter) {
        listReq.input("rate", sql.Int, Number(rate));
    }

    const listQuery = `
        SELECT ${commentColumns}, 
               u.full_name AS user_full_name, 
               u.username AS user_username, 
               u.avatar AS user_avatar,
               COALESCE(u.isAdmin, 0) AS user_isAdmin
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        ${whereClause}
        ORDER BY c.createdAt DESC, c.id DESC
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const listRes = await listReq.query(listQuery);
    return listRes.recordset;
}

async function findByBookId(bookId, { page = 1, limit = 10, includeDeleted = false, type = "all", rate = null } = {}) {
    const pool = await connectDB();
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const maxSafePage = Math.floor(2147483647 / safeLimit);
    const safePage = Math.max(1, Math.min(maxSafePage, Number(page) || 1));
    const hasRateFilter = rate !== null && rate !== undefined && rate !== "";

    let whereClause = "WHERE c.book_id = @book_id AND c.parent_id IS NULL";
    if (!includeDeleted) {
        whereClause += " AND c.isDelete = 0";
    }
    if (type === "reviews") {
        whereClause += " AND c.rate IS NOT NULL";
    } else if (type === "discussions") {
        whereClause += " AND c.rate IS NULL";
    }
    if (hasRateFilter) {
        whereClause += " AND c.rate = @rate";
    }

    const countReq = new sql.Request(pool).input("book_id", sql.Int, Number(bookId));
    if (hasRateFilter) {
        countReq.input("rate", sql.Int, Number(rate));
    }

    const countQuery = `SELECT COUNT(1) AS total FROM dbo.comments c ${whereClause}`;
    const offset = (safePage - 1) * safeLimit;

    const [countRes, initialComments] = await Promise.all([
        countReq.query(countQuery),
        executeBookReviewsList(pool, whereClause, { bookId, hasRateFilter, rate, offset, safeLimit })
    ]);

    const total = countRes.recordset[0]?.total || 0;
    const totalPages = Math.ceil(total / safeLimit) || 1;
    const clampedPage = Math.min(safePage, totalPages);

    const comments = total > 0 && clampedPage !== safePage
        ? await executeBookReviewsList(pool, whereClause, {
            bookId,
            hasRateFilter,
            rate,
            offset: (clampedPage - 1) * safeLimit,
            safeLimit
        })
        : initialComments;

    return {
        comments,
        total,
        page: clampedPage,
        limit: safeLimit,
        totalPages
    };
}

async function getBookRatingSummary(bookId) {
    const pool = await connectDB();
    const query = `
        SELECT 
            COUNT(CASE WHEN parent_id IS NULL AND rate IS NOT NULL THEN 1 END) AS totalReviews,
            COUNT(CASE WHEN parent_id IS NULL AND rate IS NULL THEN 1 END) AS totalDiscussions,
            COUNT(CASE WHEN parent_id IS NOT NULL THEN 1 END) AS totalReplies,
            CAST(ROUND(COALESCE(AVG(CAST(CASE WHEN parent_id IS NULL THEN rate END AS FLOAT)), 0), 1) AS FLOAT) AS avgRating,
            SUM(CASE WHEN parent_id IS NULL AND rate = 5 THEN 1 ELSE 0 END) AS count5Star,
            SUM(CASE WHEN parent_id IS NULL AND rate = 4 THEN 1 ELSE 0 END) AS count4Star,
            SUM(CASE WHEN parent_id IS NULL AND rate = 3 THEN 1 ELSE 0 END) AS count3Star,
            SUM(CASE WHEN parent_id IS NULL AND rate = 2 THEN 1 ELSE 0 END) AS count2Star,
            SUM(CASE WHEN parent_id IS NULL AND rate = 1 THEN 1 ELSE 0 END) AS count1Star
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
        totalReplies: row.totalReplies || 0,
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
        WHERE id = @id
          AND user_id = @user_id
          AND isDelete = 0
          AND EXISTS (
              SELECT 1
              FROM dbo.books b
              WHERE b.id = dbo.comments.book_id AND b.isDelete = 0
          )
          AND (
              dbo.comments.parent_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM dbo.comments p
                  WHERE p.id = dbo.comments.parent_id AND p.isDelete = 0
              )
          )
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
        WHERE id = @id
          AND isDelete = @currentStatus
          AND (
              @targetFlag = 1
              OR dbo.comments.parent_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM dbo.comments p
                  WHERE p.id = dbo.comments.parent_id AND p.isDelete = 0
              )
          )
    `;

    try {
        const result = await new sql.Request(executor)
            .input("id", sql.Int, Number(id))
            .input("targetFlag", sql.TinyInt, targetFlag)
            .input("currentStatus", sql.TinyInt, currentStatus)
            .query(query);

        return result.recordset[0] || null;
    } catch (error) {
        handleCommentWriteError(
            error,
            targetFlag === 0
                ? "Người dùng đã có bài đánh giá đang hoạt động cho cuốn sách này, không thể khôi phục bài đánh giá trùng lặp."
                : undefined
        );
    }
}

async function findAllAdmin({ page = 1, limit = 10, bookId = null, rate = null, isDelete = null, search = null, type = null } = {}) {
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

    if (type === "discussions" || rate === "discussion" || rate === "0" || rate === 0) {
        whereClauses.push("c.rate IS NULL");
    } else if (type === "reviews") {
        whereClauses.push("c.rate IS NOT NULL");
        if (rate !== null && rate !== undefined && rate !== "" && Number.isInteger(Number(rate))) {
            whereClauses.push("c.rate = @rate");
            countReq.input("rate", sql.Int, Number(rate));
            listReq.input("rate", sql.Int, Number(rate));
        }
    } else if (rate !== null && rate !== undefined && rate !== "" && Number.isInteger(Number(rate))) {
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
               b.title AS book_title,
               parent_u.full_name AS parent_user_full_name,
               parent_u.username AS parent_user_username
        FROM dbo.comments c
        LEFT JOIN dbo.Users u ON c.user_id = u.id
        LEFT JOIN dbo.books b ON c.book_id = b.id
        LEFT JOIN dbo.comments parent_c ON c.parent_id = parent_c.id
        LEFT JOIN dbo.Users parent_u ON parent_c.user_id = parent_u.id
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
    findRepliesByParentIds,
    findByBookId,
    getBookRatingSummary,
    update,
    changeStatus,
    findAllAdmin
};
