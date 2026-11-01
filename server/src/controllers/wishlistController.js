const wishlistService = require("../services/wishlistService");

async function getWishlist(req, res) {
    const wishlist = await wishlistService.getWishlist(req.user.id);
    res.json(wishlist);
}

async function addItem(req, res) {
    const result = await wishlistService.addBookToWishlist(req.user.id, req.body.bookId);
    res.status(201).json(result);
}

async function removeItem(req, res) {
    const result = await wishlistService.removeBookFromWishlist(req.user.id, req.params.bookId);
    res.json(result);
}

async function clearWishlist(req, res) {
    const result = await wishlistService.clearUserWishlist(req.user.id);
    res.json(result);
}

module.exports = {
    getWishlist,
    addItem,
    removeItem,
    clearWishlist,
};

