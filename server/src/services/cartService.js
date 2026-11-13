const cartModel = require("../models/cartModel");
const bookModel = require("../models/bookModel");
const discountService = require("./discountService");
const storePolicyService = require("./storePolicyService");
const AppError = require("../utils/AppError");
const {
    calculateDiscountedUnitPrice,
    calculateShippingFee,
    calculateSelectedItemsTotals
} = require("../utils/pricing");

function validateBookId(id) {
    const bookId = Number(id);
    if (!bookId || !Number.isInteger(bookId) || bookId <= 0) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    return bookId;
}

function validateQuantity(quantity, max = 1000) {
    const num = Number(quantity);
    if (!num || !Number.isInteger(num) || num <= 0) {
        throw new AppError("Số lượng sách phải là số nguyên dương lớn hơn 0.", 400);
    }
    if (num > max) {
        throw new AppError(`Số lượng sách không được vượt quá ${max} cuốn mỗi lần.`, 400);
    }
    return num;
}

function handleCartWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627 || error.number === 1205)) {
        throw new AppError("Trạng thái giỏ hàng đã thay đổi, vui lòng thử lại.", 409, error);
    }
    throw error;
}

async function getCart(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const cart = await cartModel.getOrCreateCart(userId);
    const details = await cartModel.getCartDetails(cart.id);

    const items = details.map((item) => ({
        bookId: item.book_id,
        title: item.title,
        author: item.author,
        price: item.price,
        discount: item.discount,
        unitPrice: calculateDiscountedUnitPrice(item.price, item.discount),
        image: item.image,
        stockQuantity: Math.max(0, Number(item.stock_quantity) || 0),
        isDeleted: item.book_is_deleted === 1,
        quantity: item.quantity,
        total: item.total,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    }));

    const syncedCart = await cartModel.syncTotals(cart.id);

    const shippingRule = await storePolicyService.getShippingPolicy();
    const shippingFee = calculateShippingFee(syncedCart.total, shippingRule);

    return {
        id: syncedCart.id,
        userId: syncedCart.user_id,
        total: syncedCart.total,
        totalQuantity: syncedCart.total_quantity,
        shippingFee,
        shippingRule,
        discountId: syncedCart.discount_id,
        createdAt: syncedCart.createdAt,
        updatedAt: syncedCart.updatedAt,
        items,
    };
}

async function addItem(userId, { bookId, quantity = 1 }) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const validBookId = validateBookId(bookId);
    const validQuantity = validateQuantity(quantity);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    if (book.quantity <= 0) {
        throw new AppError("Sách này hiện đã hết hàng trong kho.", 400);
    }

    const cart = await cartModel.getOrCreateCart(userId);
    const existing = await cartModel.findDetail(cart.id, validBookId);
    const targetQuantity = existing ? existing.quantity + validQuantity : validQuantity;

    if (targetQuantity > book.quantity) {
        throw new AppError(`Số lượng sách yêu cầu vượt quá tồn kho (hiện còn ${book.quantity} cuốn).`, 400);
    }

    const unitPrice = calculateDiscountedUnitPrice(book.price, book.discount);
    const itemTotal = unitPrice * targetQuantity;

    try {
        await cartModel.saveItemAndSync({
            cartId: cart.id,
            bookId: validBookId,
            quantity: targetQuantity,
            total: itemTotal,
        });
    } catch (error) {
        handleCartWriteError(error);
    }

    return await getCart(userId);
}

async function updateItemQuantity(userId, bookId, quantity) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const validBookId = validateBookId(bookId);
    const validQuantity = validateQuantity(quantity);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    if (book.quantity <= 0) {
        throw new AppError("Sách này hiện đã hết hàng trong kho.", 400);
    }

    if (validQuantity > book.quantity) {
        throw new AppError(`Số lượng sách yêu cầu vượt quá tồn kho (hiện còn ${book.quantity} cuốn).`, 400);
    }

    const cart = await cartModel.getOrCreateCart(userId);
    const existing = await cartModel.findDetail(cart.id, validBookId);
    if (!existing) {
        throw new AppError("Sách không có trong giỏ hàng.", 404);
    }

    if (validQuantity === existing.quantity) {
        return await getCart(userId);
    }

    const unitPrice = calculateDiscountedUnitPrice(book.price, book.discount);
    const itemTotal = unitPrice * validQuantity;

    try {
        await cartModel.saveItemAndSync({
            cartId: cart.id,
            bookId: validBookId,
            quantity: validQuantity,
            total: itemTotal,
        });
    } catch (error) {
        handleCartWriteError(error);
    }

    return await getCart(userId);
}

async function removeItem(userId, bookId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const validBookId = validateBookId(bookId);

    const cart = await cartModel.getOrCreateCart(userId);
    const existing = await cartModel.findDetail(cart.id, validBookId);
    if (!existing) {
        throw new AppError("Sách không có trong giỏ hàng.", 404);
    }

    try {
        await cartModel.removeItemAndSync(cart.id, validBookId);
    } catch (error) {
        handleCartWriteError(error);
    }

    return await getCart(userId);
}

async function clearCart(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);

    const cart = await cartModel.getOrCreateCart(userId);
    try {
        await cartModel.clearCartAndSync(cart.id);
    } catch (error) {
        handleCartWriteError(error);
    }

    return await getCart(userId);
}

async function calculateCartSummary(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const cart = await cartModel.getOrCreateCart(userId);
    const details = await cartModel.getCartDetails(cart.id);

    let subtotal = 0;
    let discountTotal = 0;
    let finalTotal = 0;
    let totalQuantity = 0;

    for (const item of details) {
        if (!item.title || item.book_is_deleted === null) continue;
        const originalPrice = Math.max(0, Number(item.price) || 0);
        const discountRate = Math.max(0, Math.min(100, Number(item.discount) || 0));
        const unitPrice = calculateDiscountedUnitPrice(originalPrice, discountRate);
        const quantity = Math.max(0, Number(item.quantity) || 0);

        subtotal += originalPrice * quantity;
        discountTotal += (originalPrice - unitPrice) * quantity;
        finalTotal += unitPrice * quantity;
        totalQuantity += quantity;
    }

    if (finalTotal > 2000000000) {
        throw new AppError("Tổng giá trị giỏ hàng vượt quá giới hạn xử lý tối đa của hệ thống.", 400);
    }

    const shippingRule = await storePolicyService.getShippingPolicy();
    const shippingFee = calculateShippingFee(finalTotal, shippingRule);

    return {
        cartId: cart.id,
        userId,
        subtotal,
        discountTotal,
        finalTotal,
        shippingFee,
        shippingRule,
        totalQuantity,
        itemCount: details.length,
    };
}

async function validateCart(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const cart = await cartModel.getOrCreateCart(userId);
    const details = await cartModel.getCartDetails(cart.id);

    if (details.length === 0) {
        return {
            cartId: cart.id,
            userId,
            isValid: false,
            message: "Giỏ hàng hiện đang trống.",
            summary: {
                subtotal: 0,
                discountTotal: 0,
                finalTotal: 0,
                totalQuantity: 0,
                itemCount: 0,
            },
            items: [],
        };
    }

    let isAllValid = true;
    let subtotal = 0;
    let discountTotal = 0;
    let finalTotal = 0;
    let totalQuantity = 0;

    const validatedItems = details.map((item) => {
        const isNotFound = !item.title || item.book_is_deleted === null;
        const originalPrice = isNotFound ? 0 : Math.max(0, Number(item.price) || 0);
        const discountRate = isNotFound ? 0 : Math.max(0, Math.min(100, Number(item.discount) || 0));
        const currentUnitPrice = calculateDiscountedUnitPrice(originalPrice, discountRate);
        const quantity = Math.max(0, Number(item.quantity) || 0);
        const currentTotal = currentUnitPrice * quantity;
        const stockQuantity = isNotFound ? 0 : Math.max(0, Number(item.stock_quantity) || 0);
        const isDeleted = item.book_is_deleted === 1;

        let status = "VALID";
        let message = "Hợp lệ.";
        let itemValid = true;

        if (isNotFound) {
            status = "NOT_FOUND";
            message = "Sách không còn tồn tại trên hệ thống.";
            itemValid = false;
        } else if (isDeleted) {
            status = "DISCONTINUED";
            message = "Sách này đã ngừng kinh doanh.";
            itemValid = false;
        } else if (stockQuantity <= 0) {
            status = "OUT_OF_STOCK";
            message = "Sách này hiện đã hết hàng trong kho.";
            itemValid = false;
        } else if (quantity > stockQuantity) {
            status = "EXCEED_STOCK";
            message = `Số lượng yêu cầu (${quantity}) vượt quá tồn kho hiện tại (còn ${stockQuantity} cuốn).`;
            itemValid = false;
        }

        const priceChanged = !isNotFound && item.total !== currentTotal;
        if (priceChanged && itemValid) {
            status = "PRICE_CHANGED";
            message = "Đơn giá hoặc mức chiết khấu của sách đã thay đổi. Vui lòng đồng bộ lại giỏ hàng trước khi thanh toán.";
            itemValid = false;
        }

        if (!itemValid) {
            isAllValid = false;
        }

        subtotal += originalPrice * quantity;
        discountTotal += (originalPrice - currentUnitPrice) * quantity;
        finalTotal += currentTotal;
        totalQuantity += quantity;

        return {
            bookId: item.book_id,
            title: item.title || "Sách không tồn tại",
            author: item.author || "",
            image: item.image || null,
            quantity,
            stockQuantity,
            originalPrice,
            discount: discountRate,
            unitPrice: currentUnitPrice,
            total: currentTotal,
            priceChanged,
            status,
            message,
            isValid: itemValid,
        };
    });

    if (finalTotal > 2000000000) {
        throw new AppError("Tổng giá trị giỏ hàng vượt quá giới hạn xử lý tối đa của hệ thống.", 400);
    }

    return {
        cartId: cart.id,
        userId,
        isValid: isAllValid,
        message: isAllValid ? "Toàn bộ giỏ hàng hợp lệ để thanh toán." : "Một số sản phẩm trong giỏ hàng không đủ điều kiện thanh toán.",
        summary: {
            subtotal,
            discountTotal,
            finalTotal,
            totalQuantity,
            itemCount: details.length,
        },
        items: validatedItems,
    };
}

async function syncCart(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const cart = await cartModel.getOrCreateCart(userId);
    const details = await cartModel.getCartDetails(cart.id);

    for (const item of details) {
        if (!item.title || item.book_is_deleted === null) {
            try {
                await cartModel.removeItemAndSync(cart.id, item.book_id);
            } catch (error) {
                handleCartWriteError(error);
            }
            continue;
        }

        const unitPrice = calculateDiscountedUnitPrice(item.price, item.discount);
        const expectedTotal = unitPrice * item.quantity;
        if (item.total !== expectedTotal) {
            try {
                await cartModel.saveItemAndSync({
                    cartId: cart.id,
                    bookId: item.book_id,
                    quantity: item.quantity,
                    total: expectedTotal,
                });
            } catch (error) {
                handleCartWriteError(error);
            }
        }
    }

    await cartModel.syncTotals(cart.id);
    return await validateCart(userId);
}

async function applyCoupon(userId, { code, selectedBookIds = null } = {}) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    if (!code || typeof code !== "string" || !code.trim()) {
        throw new AppError("Vui lòng cung cấp mã khuyến mãi.", 400);
    }
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length > 50) {
        throw new AppError("Mã khuyến mãi không được vượt quá 50 ký tự.", 400);
    }

    const cart = await cartModel.findByUserId(userId);
    if (!cart) {
        throw new AppError("Giỏ hàng không tồn tại.", 404);
    }

    const details = await cartModel.getCartDetails(cart.id);
    if (!details || details.length === 0) {
        throw new AppError("Giỏ hàng của bạn đang trống, không thể áp dụng mã khuyến mãi.", 400);
    }

    let targetItems = details;
    if (Array.isArray(selectedBookIds) && selectedBookIds.length > 0) {
        const cartBookIds = new Set(details.map((item) => Number(item.book_id)));
        for (const id of selectedBookIds) {
            const numId = Number(id);
            if (!Number.isInteger(numId) || numId <= 0 || !cartBookIds.has(numId)) {
                throw new AppError(`Sản phẩm với mã ID ${id} không có trong giỏ hàng của bạn.`, 400);
            }
        }
        const selectedSet = new Set(selectedBookIds.map((id) => Number(id)));
        targetItems = details.filter((item) => selectedSet.has(Number(item.book_id)));
    }

    if (targetItems.length === 0) {
        throw new AppError("Không có sản phẩm nào được chọn để áp dụng khuyến mãi.", 400);
    }

    for (const item of targetItems) {
        if (item.book_is_deleted === 1) {
            throw new AppError(`Sản phẩm "${item.title || item.book_id}" đã ngừng kinh doanh, không thể áp dụng mã.`, 400);
        }
        if (Number(item.stock_quantity) <= 0) {
            throw new AppError(`Sản phẩm "${item.title || item.book_id}" hiện đã hết hàng, không thể áp dụng mã.`, 400);
        }
        if (item.quantity > item.stock_quantity) {
            throw new AppError(`Số lượng sách "${item.title || item.book_id}" trong giỏ vượt quá tồn kho (hiện còn ${item.stock_quantity} cuốn).`, 400);
        }
    }

    const { subtotal } = calculateSelectedItemsTotals(targetItems);
    const promoResult = await discountService.validateAndCalculatePromotion({
        code,
        subtotal
    });

    return {
        isValid: true,
        couponCode: promoResult.discount.code,
        subtotal,
        shippingFee: promoResult.shippingFee,
        shippingRule: promoResult.shippingRule,
        discountAmount: promoResult.discountAmount,
        finalTotal: promoResult.finalTotal,
        discount: {
            code: promoResult.discount.code,
            discount_type: promoResult.discount.discount_type,
            value: promoResult.discount.value,
            maxDiscountValue: promoResult.discount.maxDiscountValue,
            minimumOrderValue: promoResult.discount.minimumOrderValue,
            description: promoResult.discount.description
        },
        message: promoResult.message
    };
}

module.exports = {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
    calculateCartSummary,
    validateCart,
    syncCart,
    applyCoupon,
};
