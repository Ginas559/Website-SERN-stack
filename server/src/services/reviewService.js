const commentModel = require("../models/commentModel");
const bookModel = require("../models/bookModel");
const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

function validateRate(rate) {
    const numRate = Number(rate);
    if (!Number.isInteger(numRate) || numRate < 1 || numRate > 5) {
        throw new AppError("Số sao đánh giá phải là số nguyên từ 1 đến 5.", 400);
    }
    return numRate;
}

function validateValue(value) {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.length > 1000) {
        throw new AppError("Nội dung đánh giá không được vượt quá 1000 ký tự.", 400);
    }
    return trimmed;
}

function validateBookId(bookId) {
    const numId = Number(bookId);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    return numId;
}

async function checkUserPurchased(userId, bookId) {
    if (!userId || !bookId) return false;
    const pool = await connectDB();
    const query = `
        SELECT TOP 1 1 AS hasPurchased
        FROM dbo.orders o
        JOIN dbo.order_details od ON o.id = od.order_id
        WHERE o.user_id = @userId 
          AND od.book_id = @bookId 
          AND o.status IN (1, 2, 3)
    `;

    const result = await new sql.Request(pool)
        .input("userId", sql.Char(36), userId)
        .input("bookId", sql.Int, Number(bookId))
        .query(query);

    return Boolean(result.recordset[0]?.hasPurchased);
}

async function createReview({ bookId, userId, rate, value }) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để đánh giá sách.", 401);
    }

    const validBookId = validateBookId(bookId);
    const validRate = validateRate(rate);
    const validValue = validateValue(value);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const existingReview = await commentModel.findUserReview(validBookId, userId, { includeDeleted: false });
    if (existingReview) {
        throw new AppError("Bạn đã có bài đánh giá cho cuốn sách này rồi.", 409);
    }

    const isPurchased = await checkUserPurchased(userId, validBookId);

    const created = await commentModel.create({
        bookId: validBookId,
        userId,
        rate: validRate,
        value: validValue
    });

    return {
        ...created,
        isPurchased
    };
}

async function getBookReviews(bookId, { page = 1, limit = 10 } = {}) {
    const validBookId = validateBookId(bookId);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const [reviewsResult, summary] = await Promise.all([
        commentModel.findByBookId(validBookId, { page, limit }),
        commentModel.getBookRatingSummary(validBookId)
    ]);

    const userIds = [...new Set(reviewsResult.comments.map((c) => c.user_id).filter(Boolean))];
    const purchasedMap = new Map();

    if (userIds.length > 0) {
        const pool = await connectDB();
        const query = `
            SELECT DISTINCT o.user_id
            FROM dbo.orders o
            JOIN dbo.order_details od ON o.id = od.order_id
            WHERE od.book_id = @bookId
              AND o.status IN (1, 2, 3)
              AND o.user_id IN (${userIds.map((_, i) => `@u${i}`).join(", ")})
        `;
        const req = new sql.Request(pool).input("bookId", sql.Int, validBookId);
        userIds.forEach((uId, i) => req.input(`u${i}`, sql.Char(36), uId));

        const res = await req.query(query);
        res.recordset.forEach((r) => purchasedMap.set(r.user_id, true));
    }

    const enrichedComments = reviewsResult.comments.map((c) => ({
        ...c,
        isPurchased: Boolean(purchasedMap.get(c.user_id))
    }));

    return {
        comments: enrichedComments,
        summary,
        total: reviewsResult.total,
        page: reviewsResult.page,
        limit: reviewsResult.limit,
        totalPages: reviewsResult.totalPages
    };
}

async function updateReview(id, userId, { rate, value }) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để cập nhật bài đánh giá.", 401);
    }

    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID đánh giá không hợp lệ.", 400);
    }

    const existing = await commentModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy bài đánh giá.", 404);
    }

    if (existing.user_id !== userId) {
        throw new AppError("Bạn không có quyền chỉnh sửa bài đánh giá này.", 403);
    }

    if (existing.isDelete === 1) {
        throw new AppError("Không thể chỉnh sửa bài đánh giá đã bị ẩn.", 400);
    }

    const validRate = rate !== undefined ? validateRate(rate) : existing.rate;
    const validValue = value !== undefined ? validateValue(value) : existing.value;

    if (validRate === existing.rate && validValue === existing.value) {
        return existing;
    }

    const updated = await commentModel.update(numId, userId, {
        rate: validRate,
        value: validValue
    });

    if (!updated) {
        throw new AppError("Bài đánh giá đã thay đổi hoặc không thể cập nhật.", 409);
    }

    return updated;
}

async function deleteReview(id, userId) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để xóa bài đánh giá.", 401);
    }

    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID đánh giá không hợp lệ.", 400);
    }

    const existing = await commentModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy bài đánh giá.", 404);
    }

    if (existing.user_id !== userId) {
        throw new AppError("Bạn không có quyền xóa bài đánh giá này.", 403);
    }

    if (existing.isDelete === 1) {
        return { message: "Bài đánh giá đã được xóa thành công." };
    }

    const deleted = await commentModel.changeStatus(numId, 1);
    if (!deleted) {
        throw new AppError("Trạng thái bài đánh giá đã thay đổi, vui lòng thử lại.", 409);
    }

    return { message: "Xóa bài đánh giá thành công." };
}

async function adminGetReviews(query = {}) {
    return await commentModel.findAllAdmin(query);
}

async function adminChangeReviewStatus(id, isDelete) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID đánh giá không hợp lệ.", 400);
    }

    const existing = await commentModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy bài đánh giá.", 404);
    }

    const targetFlag = isDelete ? 1 : 0;
    if (existing.isDelete === targetFlag) {
        return existing;
    }

    const updated = await commentModel.changeStatus(numId, targetFlag);
    if (!updated) {
        throw new AppError("Trạng thái bài đánh giá đã thay đổi, vui lòng thử lại.", 409);
    }

    return updated;
}

module.exports = {
    createReview,
    getBookReviews,
    updateReview,
    deleteReview,
    adminGetReviews,
    adminChangeReviewStatus
};

