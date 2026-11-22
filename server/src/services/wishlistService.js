const wishlistModel = require("../models/wishlistModel");
const bookModel = require("../models/bookModel");
const AppError = require("../utils/AppError");

function validateBookId(id) {
    const bookId = Number(id);
    if (!bookId || !Number.isInteger(bookId) || bookId <= 0) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    return bookId;
}

function calculateUnitPrice(price, discount = 0) {
    const rawPrice = Math.max(0, Number(price) || 0);
    const rate = Math.max(0, Math.min(100, Number(discount) || 0));
    if (rate <= 0) return rawPrice;
    return Math.round(rawPrice * (1 - rate / 100));
}

function handleWishlistWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627 || error.number === 1205)) {
        throw new AppError("Trạng thái danh sách yêu thích đã thay đổi, vui lòng thử lại.", 409, error);
    }
    throw error;
}

async function getWishlist(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const wishlist = await wishlistModel.getOrCreateWishlist(userId);
    const details = await wishlistModel.getWishlistDetails(wishlist.id);

    const items = details.map((item) => ({
        bookId: item.book_id,
        title: item.title,
        author: item.author,
        price: item.price,
        discount: item.discount,
        unitPrice: calculateUnitPrice(item.price, item.discount),
        image: item.image,
        stockQuantity: Math.max(0, Number(item.stock_quantity) || 0),
        isDeleted: item.book_is_deleted === 1,
        isAvailable: item.book_is_deleted === 0 && Number(item.stock_quantity) > 0,
        addedAt: item.added_at,
    }));

    return {
        id: wishlist.id,
        userId: wishlist.user_id,
        totalItems: items.length,
        createdAt: wishlist.createdAt,
        updatedAt: wishlist.updatedAt,
        items,
    };
}

async function addBookToWishlist(userId, bookId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const validBookId = validateBookId(bookId);

    const book = await bookModel.findById(validBookId);
    if (!book || book.isDelete === 1) {
        throw new AppError("Sách không tồn tại hoặc đã ngừng kinh doanh.", 404);
    }

    const wishlist = await wishlistModel.getOrCreateWishlist(userId);
    const existing = await wishlistModel.findBookInWishlist(wishlist.id, validBookId);
    if (existing) {
        return {
            message: "Sách đã có trong danh sách yêu thích.",
            isAdded: true,
            bookId: validBookId,
        };
    }

    try {
        await wishlistModel.addBook(wishlist.id, validBookId);
        return {
            message: "Thêm sách vào danh sách yêu thích thành công.",
            isAdded: true,
            bookId: validBookId,
        };
    } catch (error) {
        handleWishlistWriteError(error);
    }
}

async function removeBookFromWishlist(userId, bookId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);
    const validBookId = validateBookId(bookId);

    const wishlist = await wishlistModel.findByUserId(userId);
    if (!wishlist) {
        return {
            message: "Sách đã được xóa khỏi danh sách yêu thích.",
            isDeleted: true,
            bookId: validBookId,
        };
    }

    const existing = await wishlistModel.findBookInWishlist(wishlist.id, validBookId);
    if (!existing) {
        return {
            message: "Sách đã được xóa khỏi danh sách yêu thích.",
            isDeleted: true,
            bookId: validBookId,
        };
    }

    try {
        await wishlistModel.removeBook(wishlist.id, validBookId);
        return {
            message: "Xóa sách khỏi danh sách yêu thích thành công.",
            isDeleted: true,
            bookId: validBookId,
        };
    } catch (error) {
        handleWishlistWriteError(error);
    }
}

async function clearUserWishlist(userId) {
    if (!userId) throw new AppError("Người dùng không hợp lệ.", 401);

    const wishlist = await wishlistModel.findByUserId(userId);
    if (!wishlist) {
        return {
            message: "Danh sách yêu thích đã trống.",
            cleared: true,
        };
    }

    try {
        await wishlistModel.clearWishlist(wishlist.id);
        return {
            message: "Xóa toàn bộ danh sách yêu thích thành công.",
            cleared: true,
        };
    } catch (error) {
        handleWishlistWriteError(error);
    }
}

module.exports = {
    getWishlist,
    addBookToWishlist,
    removeBookFromWishlist,
    clearUserWishlist,
};

