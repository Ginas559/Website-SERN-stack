const cartModel = require("../models/cartModel");
const bookModel = require("../models/bookModel");
const AppError = require("../utils/AppError");

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

function calculateUnitPrice(price, discount = 0) {
    const rate = Number(discount) || 0;
    if (rate <= 0) return price;
    return Math.round(price * (1 - rate / 100));
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
        unitPrice: calculateUnitPrice(item.price, item.discount),
        image: item.image,
        stockQuantity: item.stock_quantity,
        isDeleted: item.book_is_deleted === 1,
        quantity: item.quantity,
        total: item.total,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    }));

    const syncedCart = await cartModel.syncTotals(cart.id);

    return {
        id: syncedCart.id,
        userId: syncedCart.user_id,
        total: syncedCart.total,
        totalQuantity: syncedCart.total_quantity,
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

    const unitPrice = calculateUnitPrice(book.price, book.discount);
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

    const unitPrice = calculateUnitPrice(book.price, book.discount);
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

module.exports = {
    getCart,
    addItem,
    updateItemQuantity,
    removeItem,
    clearCart,
};
