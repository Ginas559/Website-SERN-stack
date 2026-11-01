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

async function cancelOrder(req, res, next) {
    try {
        const userId = req.user.id;
        const isAdmin = Boolean(req.user.isAdmin);
        const result = await orderService.cancelOrder(req.params.id, userId, {
            reason: req.body.reason,
            isAdmin
        });
        return res.status(200).json({
            status: "success",
            message: "Hủy đơn hàng thành công.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function updateStatus(req, res, next) {
    try {
        const result = await orderService.updateOrderStatus(req.params.id, req.body.status, {
            currentStatus: req.body.currentStatus
        });
        return res.status(200).json({
            status: "success",
            message: "Cập nhật trạng thái đơn hàng thành công.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder,
    cancelOrder,
    updateStatus
};

