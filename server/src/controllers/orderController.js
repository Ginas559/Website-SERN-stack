const orderService = require("../services/orderService");

async function createOrder(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await orderService.createOrderFromCart(userId, req.body);
        return res.status(201).json({
            status: "success",
            message: "Tạo đơn hàng thành công.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder
};

