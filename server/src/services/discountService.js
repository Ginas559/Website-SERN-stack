const discountModel = require("../models/discountModel");
const AppError = require("../utils/AppError");

function formatDiscountResponse(discount) {
    if (!discount) return null;
    return {
        id: discount.id,
        code: discount.code,
        discount_type: discount.discount_type,
        value: discount.value,
        maxDiscountValue: discount.maxDiscountValue,
        minimumOrderValue: discount.minimumOrderValue,
        description: discount.description,
        startDate: discount.startDate,
        expiredAt: discount.expiredAt
    };
}

async function getActiveDiscounts({ page = 1, limit = 10, search = "" } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 10));

    const result = await discountModel.findAll({
        page: safePage,
        limit: safeLimit,
        search,
        status: "active",
        isDelete: 0
    });

    return {
        discounts: result.discounts.map(formatDiscountResponse),
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
    };
}

async function getDiscountById(id) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID khuyến mãi không hợp lệ.", 400);
    }

    const discount = await discountModel.findById(numId, { includeDeleted: false });
    if (!discount) {
        throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
    }

    return formatDiscountResponse(discount);
}

async function getDiscountByCode(code) {
    if (!code || typeof code !== "string" || !code.trim()) {
        throw new AppError("Mã khuyến mãi không hợp lệ.", 400);
    }

    const discount = await discountModel.findByCode(code.trim().toUpperCase(), { includeDeleted: false });
    if (!discount) {
        throw new AppError("Mã khuyến mãi không tồn tại hoặc đã hết hiệu lực.", 404);
    }

    const now = new Date();
    if (discount.startDate && new Date(discount.startDate) > now) {
        throw new AppError("Mã khuyến mãi chưa đến thời gian áp dụng.", 400);
    }

    if (discount.expiredAt && new Date(discount.expiredAt) < now) {
        throw new AppError("Mã khuyến mãi đã hết hạn sử dụng.", 400);
    }

    if (discount.usedCount >= discount.quantity) {
        throw new AppError("Mã khuyến mãi đã hết lượt sử dụng.", 400);
    }

    return formatDiscountResponse(discount);
}

module.exports = {
    getActiveDiscounts,
    getDiscountById,
    getDiscountByCode,
    formatDiscountResponse
};

