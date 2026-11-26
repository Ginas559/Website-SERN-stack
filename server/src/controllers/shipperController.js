const orderAssignmentService = require("../services/orderAssignmentService");

async function getAssignments(req, res, next) {
    try {
        const result = await orderAssignmentService.getAssignmentsForShipper({
            shipperId: req.user.id,
            status: req.query.status,
            search: req.query.search,
            page: req.query.page,
            limit: req.query.limit
        });
        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function acceptAssignment(req, res, next) {
    try {
        const result = await orderAssignmentService.updateAssignmentByShipper({
            assignmentId: req.params.id,
            shipperId: req.user.id,
            action: "ACCEPT"
        });
        return res.status(200).json({ status: "success", message: "Đã nhận đơn hàng.", data: result });
    } catch (error) {
        next(error);
    }
}

async function rejectAssignment(req, res, next) {
    try {
        const result = await orderAssignmentService.updateAssignmentByShipper({
            assignmentId: req.params.id,
            shipperId: req.user.id,
            action: "REJECT",
            rejectionReason: req.body.reason
        });
        return res.status(200).json({ status: "success", message: "Đã từ chối nhận đơn hàng.", data: result });
    } catch (error) {
        next(error);
    }
}

async function completeAssignment(req, res, next) {
    try {
        const result = await orderAssignmentService.completeAssignment({
            assignmentId: req.params.id,
            shipperId: req.user.id,
            note: req.body.note,
            codCollected: req.body.codCollected
        });
        return res.status(200).json({ status: "success", message: "Đã hoàn tất giao hàng.", data: result });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getAssignments,
    acceptAssignment,
    rejectAssignment,
    completeAssignment
};
