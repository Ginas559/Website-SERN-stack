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
            currentStatus: req.body.currentStatus,
            note: req.body.note
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

async function getAllOrdersForAdmin(req, res, next) {
    try {
        const result = await orderService.getAllOrdersForAdmin(req.query);
        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function getUserOrders(req, res, next) {
    try {
        const userId = req.user.id;
        const { page, limit, status } = req.query;
        const result = await orderService.getUserOrders(userId, { page, limit, status });
        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function getOrderDetails(req, res, next) {
    try {
        const userId = req.user.id;
        const isAdmin = Boolean(req.user.isAdmin);
        const result = await orderService.getOrderDetails(req.params.id, userId, { isAdmin });
        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function reorder(req, res, next) {
    try {
        const userId = req.user.id;
        const result = await orderService.reorder(req.params.id, userId);
        return res.status(200).json({
            status: "success",
            message: "Đã thêm các sản phẩm từ đơn hàng cũ vào giỏ hàng.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function createPaymentUrl(req, res, next) {
    try {
        const userId = req.user.id;
        const isAdmin = Boolean(req.user.isAdmin);
        const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
        const result = await orderService.createPaymentUrlForOrder(req.params.id, userId, {
            ipAddr,
            returnUrl: req.body.returnUrl,
            isAdmin
        });
        return res.status(200).json({
            status: "success",
            message: "Tạo URL thanh toán VNPAY thành công.",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function handleVNPayReturn(req, res, next) {
    try {
        const result = await orderService.processPaymentReturn(req.query);
        const statusCode = result.isSuccess ? 200 : 400;
        return res.status(statusCode).json({
            status: result.isSuccess ? "success" : "fail",
            message: result.message,
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function handleVNPayIPN(req, res, next) {
    try {
        const result = await orderService.processPaymentIPN(req.query);
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

async function getShippingRule(req, res, next) {
    try {
        const rule = await orderService.getShippingRule();
        return res.status(200).json({
            status: "success",
            data: rule
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createOrder,
    cancelOrder,
    updateStatus,
    getUserOrders,
    getOrderDetails,
    getAllOrdersForAdmin,
    reorder,
    createPaymentUrl,
    handleVNPayReturn,
    handleVNPayIPN,
    getShippingRule
};

