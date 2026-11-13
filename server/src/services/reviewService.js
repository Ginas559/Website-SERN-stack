const commentModel = require("../models/commentModel");
const bookModel = require("../models/bookModel");
const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const MAX_INT32 = 2147483647;
const ALLOWED_REVIEW_TYPES = ["all", "reviews", "discussions"];

function validatePositiveInt(id, message) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0 || numId > MAX_INT32) {
        throw new AppError(message, 400);
    }
    return numId;
}

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
    return validatePositiveInt(bookId, "ID sách không hợp lệ.");
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

async function createReview({ userId, bookId, rate, value, parentId = null }) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để gửi phản hồi.", 401);
    }

    const validBookId = validateBookId(bookId);
    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const purchaseStatus = await checkUserPurchaseStatus(userId, validBookId);

    const hasParentId = parentId !== null && parentId !== undefined && parentId !== "";
    const isRatingReview = rate !== null && rate !== undefined && rate !== "";
    let validParentId = null;
    let validRate = null;

    if (hasParentId) {
        validParentId = validatePositiveInt(parentId, "ID bình luận gốc không hợp lệ.");

        if (isRatingReview) {
            throw new AppError("Bình luận trả lời không thể kèm đánh giá sao.", 400);
        }

        if (!value || !String(value).trim()) {
            throw new AppError("Vui lòng nhập nội dung trả lời bình luận.", 400);
        }

        const parentComment = await commentModel.findById(validParentId, { includeDeleted: true });
        if (!parentComment || parentComment.isDelete === 1) {
            throw new AppError("Bình luận gốc không tồn tại hoặc đã bị xóa.", 404);
        }
        if (Number(parentComment.book_id) !== validBookId) {
            throw new AppError("Bình luận gốc không thuộc cuốn sách này.", 400);
        }
        if (parentComment.parent_id !== null && parentComment.parent_id !== undefined) {
            throw new AppError("Chỉ hỗ trợ trả lời trực tiếp vào đánh giá hoặc thảo luận gốc.", 400);
        }
        if (parentComment.rate !== null && parentComment.rate !== undefined) {
            const pool = await connectDB();
            const actorRes = await new sql.Request(pool)
                .input("userId", sql.Char(36), userId)
                .query("SELECT TOP 1 isAdmin, isDelete FROM dbo.Users WHERE id = @userId");
            const actor = actorRes.recordset[0];
            if (!actor || actor.isDelete === 1 || !actor.isAdmin) {
                throw new AppError("Chỉ quản trị viên (Shop) mới có quyền phản hồi đánh giá sao của khách hàng.", 403);
            }
        }
    } else if (isRatingReview) {
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
        parentId: validParentId,
        rate: validRate,
        value: validValue
    });

    if (!created) {
        const currentBook = await bookModel.findById(validBookId);
        if (!currentBook || currentBook.isDelete === 1) {
            throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
        }
        if (validParentId !== null) {
            const currentParent = await commentModel.findById(validParentId, { includeDeleted: true });
            if (!currentParent || currentParent.isDelete === 1) {
                throw new AppError("Bình luận gốc không tồn tại hoặc đã bị xóa.", 404);
            }
            if (currentParent.rate !== null && currentParent.rate !== undefined) {
                throw new AppError("Chỉ quản trị viên (Shop) mới có quyền phản hồi đánh giá sao của khách hàng.", 403);
            }
            throw new AppError("Bình luận gốc không tồn tại hoặc đã bị xóa.", 404);
        }
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    return {
        ...created,
        isPurchased: purchaseStatus.hasPurchased
    };
}

async function getBookReviews(bookId, { page = 1, limit = 10, type = "all", rate = null, userId = null } = {}) {
    const validBookId = validateBookId(bookId);

    if (!ALLOWED_REVIEW_TYPES.includes(type)) {
        throw new AppError("Loại bài viết phải là all, reviews hoặc discussions.", 400);
    }

    const numLimit = limit === undefined || limit === null || limit === "" ? 10 : Number(limit);
    if (!Number.isInteger(numLimit) || numLimit < 1 || numLimit > 100) {
        throw new AppError("Số lượng mỗi trang phải từ 1 đến 100.", 400);
    }

    const maxPageForLimit = Math.floor(MAX_INT32 / numLimit);
    const numPage = page === undefined || page === null || page === "" ? 1 : Number(page);
    if (!Number.isInteger(numPage) || numPage < 1 || numPage > maxPageForLimit) {
        throw new AppError("Trang phải là số nguyên lớn hơn 0.", 400);
    }

    const validRate = rate !== undefined && rate !== null && rate !== "" ? validateRate(rate) : null;

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const [reviewsResult, summary, purchaseStatus, rawUserReview] = await Promise.all([
        commentModel.findByBookId(validBookId, { page: numPage, limit: numLimit, type, rate: validRate }),
        commentModel.getBookRatingSummary(validBookId),
        userId ? checkUserPurchaseStatus(userId, validBookId) : Promise.resolve({ canReview: false, status: "guest", hasPurchased: false }),
        userId ? commentModel.findUserReview(userId, validBookId) : Promise.resolve(null)
    ]);

    const parentIds = [
        ...new Set([
            ...reviewsResult.comments.map((c) => c.id),
            ...(rawUserReview ? [rawUserReview.id] : [])
        ])
    ];
    const rawReplies = await commentModel.findRepliesByParentIds(parentIds);

    const userIds = [
        ...new Set([
            ...reviewsResult.comments.map((c) => c.user_id),
            ...rawReplies.map((r) => r.user_id)
        ].filter(Boolean))
    ];
    const purchasedMap = new Map();

    if (userIds.length > 0) {
        const pool = await connectDB();
        for (let start = 0; start < userIds.length; start += 500) {
            const batchUserIds = userIds.slice(start, start + 500);
            const query = `
                SELECT DISTINCT o.user_id
                FROM dbo.orders o
                JOIN dbo.order_details od ON o.id = od.order_id
                WHERE od.book_id = @bookId
                  AND o.status = 3
                  AND o.user_id IN (${batchUserIds.map((_, i) => `@u${i}`).join(", ")})
            `;
            const req = new sql.Request(pool).input("bookId", sql.Int, validBookId);
            batchUserIds.forEach((uId, i) => req.input(`u${i}`, sql.Char(36), uId));

            const res = await req.query(query);
            res.recordset.forEach((r) => purchasedMap.set(r.user_id, true));
        }
    }

    const repliesByParentId = new Map();
    rawReplies.forEach((reply) => {
        const enrichedReply = {
            ...reply,
            isPurchased: Boolean(purchasedMap.get(reply.user_id))
        };
        const list = repliesByParentId.get(reply.parent_id) || [];
        list.push(enrichedReply);
        repliesByParentId.set(reply.parent_id, list);
    });

    const enrichedComments = reviewsResult.comments.map((c) => ({
        ...c,
        isPurchased: Boolean(purchasedMap.get(c.user_id)),
        replies: repliesByParentId.get(c.id) || []
    }));

    const userReview = rawUserReview
        ? {
            ...rawUserReview,
            isPurchased: Boolean(purchaseStatus?.hasPurchased),
            replies: repliesByParentId.get(rawUserReview.id) || []
        }
        : null;

    return {
        comments: enrichedComments,
        userReview,
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

    const numId = validatePositiveInt(id, "ID đánh giá không hợp lệ.");

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

    const book = await bookModel.findById(existing.book_id);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const isReply = existing.parent_id !== null && existing.parent_id !== undefined;
    let nextRate = existing.rate;

    if (isReply) {
        if (rate !== undefined && rate !== null && rate !== "") {
            throw new AppError("Bình luận trả lời không thể chấm điểm sao.", 400);
        }
        const parentComment = await commentModel.findById(existing.parent_id, { includeDeleted: true });
        if (!parentComment || parentComment.isDelete === 1) {
            throw new AppError("Bình luận gốc đã bị ẩn hoặc xóa, không thể chỉnh sửa phản hồi.", 400);
        }
        nextRate = null;
    } else if (rate !== undefined) {
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

    if ((isReply || nextRate === null) && (!nextValue || !nextValue.trim())) {
        throw new AppError(
            isReply ? "Nội dung trả lời bình luận không được để trống." : "Nội dung thảo luận không được để trống.",
            400
        );
    }

    if (nextRate === existing.rate && nextValue === existing.value) {
        return existing;
    }

    const updated = await commentModel.update(numId, userId, {
        rate: nextRate,
        value: nextValue
    });

    if (!updated) {
        const currentBook = await bookModel.findById(existing.book_id);
        if (!currentBook || currentBook.isDelete === 1) {
            throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
        }
        if (isReply) {
            const currentParent = await commentModel.findById(existing.parent_id, { includeDeleted: true });
            if (!currentParent || currentParent.isDelete === 1) {
                throw new AppError("Bình luận gốc đã bị ẩn hoặc xóa, không thể chỉnh sửa phản hồi.", 400);
            }
        }
        throw new AppError("Bài viết đã thay đổi hoặc không thể cập nhật.", 409);
    }

    return updated;
}

async function deleteReview(id, userId) {
    if (!userId) {
        throw new AppError("Vui lòng đăng nhập để xóa bài viết.", 401);
    }

    const numId = validatePositiveInt(id, "ID không hợp lệ.");

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
    const numId = validatePositiveInt(id, "ID đánh giá không hợp lệ.");

    const existing = await commentModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy bài đánh giá.", 404);
    }

    const targetFlag = isDelete ? 1 : 0;
    if (existing.isDelete === targetFlag) {
        return existing;
    }

    if (targetFlag === 0 && existing.parent_id !== null && existing.parent_id !== undefined) {
        const parentComment = await commentModel.findById(existing.parent_id, { includeDeleted: true });
        if (!parentComment || parentComment.isDelete === 1) {
            throw new AppError("Không thể khôi phục phản hồi khi bình luận gốc đang bị ẩn.", 409);
        }
    }

    const updated = await commentModel.changeStatus(numId, targetFlag);
    if (!updated) {
        if (targetFlag === 0 && existing.parent_id !== null && existing.parent_id !== undefined) {
            throw new AppError("Không thể khôi phục phản hồi khi bình luận gốc đang bị ẩn.", 409);
        }
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
