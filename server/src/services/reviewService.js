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
        throw new AppError("Nội dung không được vượt quá 1000 ký tự.", 400);
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

async function checkUserPurchaseStatus(userId, bookId) {
    if (!userId || !bookId) {
        return { canReview: false, status: "guest", hasPurchased: false };
    }
    const pool = await connectDB();
    const query = `
        SELECT 
            COUNT(CASE WHEN o.status = 3 THEN 1 END) AS deliveredCount,
            COUNT(CASE WHEN o.status IN (0, 1, 2) THEN 1 END) AS pendingCount,
            COUNT(CASE WHEN o.status = 4 THEN 1 END) AS cancelledCount
        FROM dbo.orders o
        JOIN dbo.order_details od ON o.id = od.order_id
        WHERE o.user_id = @userId AND od.book_id = @bookId
    `;

    const result = await new sql.Request(pool)
        .input("userId", sql.Char(36), userId)
        .input("bookId", sql.Int, Number(bookId))
        .query(query);

    const row = result.recordset[0] || {};
    const deliveredCount = row.deliveredCount || 0;
    const pendingCount = row.pendingCount || 0;

    if (deliveredCount > 0) {
        return { canReview: true, status: "delivered", hasPurchased: true };
    }
    if (pendingCount > 0) {
        return { canReview: false, status: "pending", hasPurchased: false };
    }
    return { canReview: false, status: "not_purchased", hasPurchased: false };
}

async function createReview({ userId, bookId, rate, value }) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để gửi phản hồi.", 401);
    }

    const validBookId = validateBookId(bookId);
    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const purchaseStatus = await checkUserPurchaseStatus(userId, validBookId);

    const isRatingReview = rate !== null && rate !== undefined && rate !== "";
    let validRate = null;

    if (isRatingReview) {
        if (!purchaseStatus.canReview) {
            if (purchaseStatus.status === "pending") {
                throw new AppError("Đơn hàng của bạn đang được xử lý hoặc đang trên đường giao. Bạn có thể đánh giá sau khi nhận sách thành công nhé!", 403);
            }
            throw new AppError("Chỉ độc giả đã mua và nhận sách thành công tại BookWeb mới có thể gửi đánh giá chất lượng.", 403);
        }

        validRate = validateRate(rate);

        const existingRating = await commentModel.findUserReview(userId, validBookId);
        if (existingRating) {
            throw new AppError("Bạn đã có bài đánh giá cho cuốn sách này rồi.", 409);
        }
    } else {
        if (!value || !String(value).trim()) {
            throw new AppError("Vui lòng nhập nội dung câu hỏi hoặc thảo luận.", 400);
        }
    }

    const validValue = validateValue(value);

    const created = await commentModel.create({
        userId,
        bookId: validBookId,
        rate: validRate,
        value: validValue
    });

    return {
        ...created,
        isPurchased: purchaseStatus.hasPurchased
    };
}

async function getBookReviews(bookId, { page = 1, limit = 10, type = "all", userId = null } = {}) {
    const validBookId = validateBookId(bookId);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const [reviewsResult, summary, purchaseStatus] = await Promise.all([
        commentModel.findByBookId(validBookId, { page, limit, type }),
        commentModel.getBookRatingSummary(validBookId),
        userId ? checkUserPurchaseStatus(userId, validBookId) : Promise.resolve({ canReview: false, status: "guest", hasPurchased: false })
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
              AND o.status = 3
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
        purchaseStatus,
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
        throw new AppError("Không tìm thấy bài viết.", 404);
    }

    if (existing.user_id !== userId) {
        throw new AppError("Bạn không có quyền chỉnh sửa bài viết này.", 403);
    }

    if (existing.isDelete === 1) {
        throw new AppError("Không thể chỉnh sửa bài viết đã bị ẩn.", 400);
    }

    let nextRate = existing.rate;
    if (rate !== undefined) {
        if (rate !== null && rate !== "") {
            const purchaseStatus = await checkUserPurchaseStatus(userId, existing.book_id);
            if (!purchaseStatus.canReview) {
                throw new AppError("Bạn chỉ có thể chấm điểm đánh giá sau khi đã mua và nhận sách thành công.", 403);
            }
            nextRate = validateRate(rate);
        } else {
            nextRate = null;
        }
    }

    const nextValue = value !== undefined ? validateValue(value) : existing.value;

    if (nextRate === null && (!nextValue || !nextValue.trim())) {
        throw new AppError("Nội dung thảo luận không được để trống.", 400);
    }

    if (nextRate === existing.rate && nextValue === existing.value) {
        return existing;
    }

    const updated = await commentModel.update(numId, userId, {
        rate: nextRate,
        value: nextValue
    });

    if (!updated) {
        throw new AppError("Bài viết đã thay đổi hoặc không thể cập nhật.", 409);
    }

    return updated;
}

async function deleteReview(id, userId) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để xóa bài viết.", 401);
    }

    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID không hợp lệ.", 400);
    }

    const existing = await commentModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy bài viết.", 404);
    }

    if (existing.user_id !== userId) {
        throw new AppError("Bạn không có quyền xóa bài viết này.", 403);
    }

    if (existing.isDelete === 1) {
        return { message: "Bài viết đã được xóa thành công." };
    }

    const deleted = await commentModel.changeStatus(numId, 1);
    if (!deleted) {
        throw new AppError("Trạng thái bài viết đã thay đổi, vui lòng thử lại.", 409);
    }

    return { message: "Xóa bài viết thành công." };
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


async function getMyReviewedBookIds(userId) {
    if (!userId) return [];
    const pool = await connectDB();
    const res = await new sql.Request(pool)
        .input("userId", sql.Char(36), userId)
        .query("SELECT DISTINCT book_id FROM dbo.comments WHERE user_id = @userId AND isDelete = 0 AND rate IS NOT NULL");
    return res.recordset.map((r) => r.book_id);
}

module.exports = {
    getMyReviewedBookIds,
    createReview,
    getBookReviews,
    updateReview,
    deleteReview,
    adminGetReviews,
    adminChangeReviewStatus,
    checkUserPurchaseStatus
};
