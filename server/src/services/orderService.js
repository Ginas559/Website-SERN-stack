const { sql, connectDB } = require("../config/connectDB");
const orderModel = require("../models/orderModel");
const orderItemModel = require("../models/orderItemModel");
const cartModel = require("../models/cartModel");
const AppError = require("../utils/AppError");

function calculateItemPrice(price, discount = 0) {
    const rawPrice = Math.max(0, Number(price) || 0);
    const rate = Math.max(0, Math.min(100, Number(discount) || 0));
    if (rate <= 0) return rawPrice;
    return Math.round(rawPrice * (1 - rate / 100));
}

function validatePhoneNumber(phone) {
    const trimmed = typeof phone === "string" ? phone.trim() : "";
    const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
    if (!trimmed || !phoneRegex.test(trimmed)) {
        throw new AppError("Số điện thoại nhận hàng không hợp lệ.", 400);
    }
    return trimmed;
}

function validateReceiverName(name) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
        throw new AppError("Họ tên người nhận không được để trống.", 400);
    }
    if (trimmed.length > 100) {
        throw new AppError("Họ tên người nhận không được vượt quá 100 ký tự.", 400);
    }
    return trimmed;
}

function validateAddress(address) {
    const trimmed = typeof address === "string" ? address.trim() : "";
    if (!trimmed) {
        throw new AppError("Địa chỉ nhận hàng không được để trống.", 400);
    }
    if (trimmed.length > 255) {
        throw new AppError("Địa chỉ nhận hàng không được vượt quá 255 ký tự.", 400);
    }
    return trimmed;
}

function calculateShippingFee(subtotal) {
    if (subtotal >= 250000 || subtotal === 0) return 0;
    return 25000;
}

function calculateDiscountValue(couponCode, subtotal, shippingFee) {
    if (!couponCode || typeof couponCode !== "string") return 0;
    const clean = couponCode.trim().toUpperCase();
    if (clean === "BOOKWEB10") {
        return Math.round(subtotal * 0.1);
    }
    if (clean === "FREESHIP") {
        return shippingFee;
    }
    return 0;
}

async function createOrderFromCart(userId, orderPayload = {}) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const receiverName = validateReceiverName(orderPayload.receiverName || orderPayload.fullName);
    const phone = validatePhoneNumber(orderPayload.phone || orderPayload.phoneNumber);
    const address = validateAddress(orderPayload.address);
    const note = orderPayload.note && typeof orderPayload.note === "string" ? orderPayload.note.trim().slice(0, 500) : null;
    const paymentMethod = orderPayload.paymentMethod === "VNPAY" ? "VNPAY" : orderPayload.paymentMethod === "BANK" ? "BANK" : "COD";

    const cart = await cartModel.findByUserId(userId);
    if (!cart) {
        throw new AppError("Giỏ hàng không tồn tại.", 404);
    }

    const cartDetails = await cartModel.getCartDetails(cart.id);
    if (!cartDetails || cartDetails.length === 0) {
        throw new AppError("Giỏ hàng của bạn đang trống, không thể tạo đơn hàng.", 400);
    }

    let targetItems = cartDetails;
    if (Array.isArray(orderPayload.selectedBookIds) && orderPayload.selectedBookIds.length > 0) {
        const cartBookIds = new Set(cartDetails.map((item) => Number(item.book_id)));
        for (const id of orderPayload.selectedBookIds) {
            const numId = Number(id);
            if (!cartBookIds.has(numId)) {
                throw new AppError(`Sản phẩm với mã ID ${id} không có trong giỏ hàng của bạn.`, 400);
            }
        }
        const selectedSet = new Set(orderPayload.selectedBookIds.map((id) => Number(id)));
        targetItems = cartDetails.filter((item) => selectedSet.has(Number(item.book_id)));
    }

    for (const item of targetItems) {
        if (item.book_is_deleted === 1) {
            throw new AppError(`Ấn phẩm "${item.title || item.book_id}" đã ngừng kinh doanh.`, 400);
        }
        const stock = Math.max(0, Number(item.stock_quantity) || 0);
        const requestedQuantity = Math.max(1, Number(item.quantity) || 1);
        if (stock <= 0) {
            throw new AppError(`Ấn phẩm "${item.title}" tạm thời hết hàng.`, 400);
        }
        if (requestedQuantity > stock) {
            throw new AppError(`Ấn phẩm "${item.title}" chỉ còn ${stock} cuốn trong kho (bạn đặt ${requestedQuantity} cuốn).`, 400);
        }
    }

    let subtotal = 0;
    let totalQuantity = 0;
    const orderItems = [];

    for (const item of targetItems) {
        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = calculateItemPrice(item.price, item.discount);
        const lineTotal = unitPrice * qty;

        subtotal += lineTotal;
        totalQuantity += qty;
        orderItems.push({
            bookId: item.book_id,
            quantity: qty,
            total: lineTotal
        });
    }

    const shippingFee = calculateShippingFee(subtotal);
    const discountValue = calculateDiscountValue(orderPayload.couponCode, subtotal, shippingFee);
    const finalTotal = Math.max(0, subtotal + shippingFee - discountValue);

    const ghnInfo = {
        receiverName,
        phone,
        address,
        note,
        subtotal,
        shippingFee,
        discountValue,
        couponCode: orderPayload.couponCode ? String(orderPayload.couponCode).trim().toUpperCase() : null
    };

    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const createdOrder = await orderModel.create({
            userId,
            total: finalTotal,
            totalQuantity,
            status: 0,
            paymentMethod,
            ghnFee: shippingFee,
            discount: orderPayload.discountId ? Number(orderPayload.discountId) : null,
            ghnInfo
        }, transaction);

        const createdDetails = await orderItemModel.createMany(createdOrder.id, orderItems, transaction);

        for (const item of targetItems) {
            const delReq = new sql.Request(transaction);
            await delReq
                .input("cart_id", sql.Char(36), cart.id)
                .input("book_id", sql.Int, item.book_id)
                .query("DELETE FROM dbo.cart_details WHERE cart_id = @cart_id AND book_id = @book_id");
        }

        const syncReq = new sql.Request(transaction);
        await syncReq
            .input("cart_id", sql.Char(36), cart.id)
            .query(`UPDATE dbo.carts
                    SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        updatedAt = GETDATE()
                    WHERE id = @cart_id`);

        await transaction.commit();

        return {
            ...createdOrder,
            ghn_info: ghnInfo,
            items: createdDetails
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return;
        }
        orderModel.handleOrderWriteError(error);
    }
}

module.exports = {
    createOrderFromCart,
    calculateItemPrice,
    calculateShippingFee,
    calculateDiscountValue,
    validatePhoneNumber,
    validateReceiverName,
    validateAddress
};
