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

function validateDiscountData({ code, discount_type, value, maxDiscountValue, minimumOrderValue, quantity, startDate, expiredAt }, isUpdate = false) {
    if (!isUpdate || code !== undefined) {
        if (!code || typeof code !== "string" || !code.trim()) {
            throw new AppError("Mã khuyến mãi không được để trống.", 400);
        }
    }

    if (!isUpdate || discount_type !== undefined) {
        if (!["PERCENT", "FIXED"].includes(discount_type)) {
            throw new AppError("Loại khuyến mãi phải là PERCENT hoặc FIXED.", 400);
        }
    }

    if (!isUpdate || value !== undefined) {
        const numValue = Number(value);
        if (!Number.isFinite(numValue) || numValue <= 0) {
            throw new AppError("Giá trị khuyến mãi phải lớn hơn 0.", 400);
        }
        if (discount_type === "PERCENT" && numValue > 100) {
            throw new AppError("Phần trăm giảm giá không được vượt quá 100%.", 400);
        }
    }

    if (maxDiscountValue !== undefined && maxDiscountValue !== null) {
        const numMax = Number(maxDiscountValue);
        if (!Number.isFinite(numMax) || numMax < 0) {
            throw new AppError("Giá trị giảm tối đa không hợp lệ.", 400);
        }
    }

    if (minimumOrderValue !== undefined && minimumOrderValue !== null) {
        const numMin = Number(minimumOrderValue);
        if (!Number.isFinite(numMin) || numMin < 0) {
            throw new AppError("Đơn hàng tối thiểu không hợp lệ.", 400);
        }
    }

    if (quantity !== undefined && quantity !== null) {
        const numQty = Number(quantity);
        if (!Number.isInteger(numQty) || numQty < 1) {
            throw new AppError("Số lượng mã phải là số nguyên lớn hơn 0.", 400);
        }
    }

    if (startDate && expiredAt) {
        if (new Date(startDate) > new Date(expiredAt)) {
            throw new AppError("Ngày bắt đầu không được lớn hơn ngày kết thúc.", 400);
        }
    }
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

async function createDiscount(discountData) {
    validateDiscountData(discountData, false);

    const cleanCode = discountData.code.trim().toUpperCase();
    const existing = await discountModel.findByCode(cleanCode, { includeDeleted: false });
    if (existing) {
        throw new AppError("Mã khuyến mãi này đã tồn tại và đang hoạt động.", 409);
    }

    return await discountModel.create({
        ...discountData,
        code: cleanCode
    });
}

async function updateDiscount(id, discountData) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID khuyến mãi không hợp lệ.", 400);
    }

    const existing = await discountModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
    }

    if (existing.isDelete === 1) {
        throw new AppError("Không thể chỉnh sửa chương trình khuyến mãi đã bị ẩn.", 400);
    }

    validateDiscountData(discountData, true);

    if (discountData.code) {
        const cleanCode = discountData.code.trim().toUpperCase();
        if (cleanCode !== existing.code) {
            const duplicate = await discountModel.findByCode(cleanCode, { includeDeleted: false });
            if (duplicate && duplicate.id !== numId) {
                throw new AppError("Mã khuyến mãi này đã tồn tại và đang hoạt động.", 409);
            }
        }
    }

    const updated = await discountModel.update(numId, discountData);
    if (!updated) {
        throw new AppError("Trạng thái chương trình khuyến mãi đã thay đổi, vui lòng thử lại.", 409);
    }

    return updated;
}

async function changeDiscountStatus(id, isDelete) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID khuyến mãi không hợp lệ.", 400);
    }

    const targetFlag = isDelete ? 1 : 0;
    const existing = await discountModel.findById(numId, { includeDeleted: true });
    if (!existing) {
        throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
    }

    if (existing.isDelete === targetFlag) {
        return existing;
    }

    let updated;
    if (targetFlag === 1) {
        updated = await discountModel.softDelete(numId);
    } else {
        const activeDuplicate = await discountModel.findByCode(existing.code, { includeDeleted: false });
        if (activeDuplicate && activeDuplicate.id !== numId) {
            throw new AppError("Mã khuyến mãi này đã tồn tại và đang hoạt động.", 409);
        }
        updated = await discountModel.restore(numId);
    }

    if (!updated) {
        throw new AppError("Trạng thái chương trình khuyến mãi đã thay đổi, vui lòng thử lại.", 409);
    }

    return updated;
}

async function getAdminDiscounts({ page = 1, limit = 10, search = "", status = "all", isDelete = null } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    return await discountModel.findAll({
        page: safePage,
        limit: safeLimit,
        search,
        status,
        isDelete: isDelete !== null && isDelete !== undefined && isDelete !== "" ? Number(isDelete) : null
    });
}

async function getAdminDiscountById(id) {
    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
        throw new AppError("ID khuyến mãi không hợp lệ.", 400);
    }

    const discount = await discountModel.findById(numId, { includeDeleted: true });
    if (!discount) {
        throw new AppError("Không tìm thấy chương trình khuyến mãi.", 404);
    }

    return discount;
}

function calculateDiscountValue(discount, subtotal) {
    if (!discount || !subtotal || subtotal <= 0) return 0;
    let discountAmount;
    if (discount.discount_type === "PERCENT") {
        discountAmount = Math.round((subtotal * discount.value) / 100);
        if (discount.maxDiscountValue !== null && discount.maxDiscountValue !== undefined && discount.maxDiscountValue > 0) {
            discountAmount = Math.min(discountAmount, discount.maxDiscountValue);
        }
    } else {
        discountAmount = Math.min(discount.value, subtotal);
    }
    return Math.max(0, Math.min(discountAmount, subtotal));
}

async function validateAndCalculatePromotion({ code, subtotal = 0, shippingFee = 0 }) {
    if (!code || typeof code !== "string" || !code.trim()) {
        throw new AppError("Vui lòng nhập mã khuyến mãi.", 400);
    }

    const numSubtotal = Number(subtotal);
    if (!Number.isFinite(numSubtotal) || numSubtotal <= 0) {
        throw new AppError("Tổng giá trị đơn hàng phải lớn hơn 0 để áp dụng mã khuyến mãi.", 400);
    }

    const numShippingFee = Math.max(0, Number(shippingFee) || 0);
    const cleanCode = code.trim().toUpperCase();

    const discount = await discountModel.findByCode(cleanCode, { includeDeleted: false });
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

    if (discount.minimumOrderValue > 0 && numSubtotal < discount.minimumOrderValue) {
        const formattedMin = Number(discount.minimumOrderValue).toLocaleString("vi-VN");
        throw new AppError(`Đơn hàng phải từ ${formattedMin} đ để áp dụng mã khuyến mãi này.`, 400);
    }

    const discountAmount = calculateDiscountValue(discount, numSubtotal);
    const finalTotal = Math.max(0, numSubtotal + numShippingFee - discountAmount);

    return {
        isValid: true,
        discount: formatDiscountResponse(discount),
        subtotal: numSubtotal,
        shippingFee: numShippingFee,
        discountAmount,
        finalTotal,
        message: "Áp dụng mã khuyến mãi thành công."
    };
}

module.exports = {
    getActiveDiscounts,
    getDiscountById,
    getDiscountByCode,
    createDiscount,
    updateDiscount,
    changeDiscountStatus,
    getAdminDiscounts,
    getAdminDiscountById,
    calculateDiscountValue,
    validateAndCalculatePromotion,
    formatDiscountResponse
};
