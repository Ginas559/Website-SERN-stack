const cartService = require("../services/cartService");

async function addItem(req, res) {
    const cart = await cartService.addItem(req.user.id, req.body);
    res.status(201).json(cart);
}

async function updateItem(req, res) {
    const cart = await cartService.updateItemQuantity(req.user.id, req.params.bookId, req.body.quantity);
    res.json(cart);
}

module.exports = {
    addItem,
    updateItem,
};
