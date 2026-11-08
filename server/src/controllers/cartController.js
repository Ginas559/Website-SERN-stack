const cartService = require("../services/cartService");

async function getCart(req, res) {
    const cart = await cartService.getCart(req.user.id);
    res.json(cart);
}

async function addItem(req, res) {
    const cart = await cartService.addItem(req.user.id, req.body);
    res.status(201).json(cart);
}

async function updateItem(req, res) {
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.bookId, req.body.quantity);
    res.json(cart);
}

async function removeItem(req, res) {
    const cart = await cartService.removeItem(req.user.id, req.params.bookId);
    res.json(cart);
}

async function clearCart(req, res) {
    const cart = await cartService.clearCart(req.user.id);
    res.json(cart);
}

async function getSummary(req, res) {
    const summary = await cartService.calculateCartSummary(req.user.id);
    res.json(summary);
}

async function validateCart(req, res) {
    const result = await cartService.validateCart(req.user.id);
    res.json(result);
}

async function syncCart(req, res) {
    const result = await cartService.syncCart(req.user.id);
    res.json(result);
}

async function applyCoupon(req, res) {
    const result = await cartService.applyCoupon(req.user.id, req.body);
    res.json(result);
}

module.exports = {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
    getSummary,
    validateCart,
    syncCart,
    applyCoupon,
};
