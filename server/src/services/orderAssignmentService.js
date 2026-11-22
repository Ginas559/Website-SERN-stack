const { v4: uuidv4, validate: validateUuid } = require("uuid");
const { sql } = require("../config/connectDB");
const AppError = require("../utils/AppError");
const orderAssignmentModel = require("../models/orderAssignmentModel");

function parseGhnInfo(value) {
    if (!value) return {};
    if (typeof value === "object") return value;
    try {
        return JSON.parse(value);
    } catch {
        return {};
    }
}

function buildShippingInfo(value) {
    const info = parseGhnInfo(value);
    return {
        provinceId: info.provinceId || null,
        districtId: info.districtId || null,
        wardCode: info.wardCode || null,
        deliveryType: info.deliveryType || null,
        estimatedDelivery: info.estimatedDelivery || null,
        address: info.address || null,
        receiverName: info.receiverName || null,
        phone: info.phone || null,
        note: info.note || null
    };
}

function validateId(value, label) {
    if (!value || !validateUuid(String(value))) {
        throw new AppError(`${label} không hợp lệ.`, 400);
    }
    return String(value);
}

const ASSIGNMENT_STATUSES = Object.freeze(["ASSIGNED", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"]);

function isInternalDeliveryType(value) {
    const normalized = String(value || "").trim().toUpperCase();
    return normalized === "INTERNAL";
}

async function getAssignmentsForShipper({ shipperId, status = null, search = null, page = 1, limit = 20 } = {}) {
    const normalizedShipperId = validateId(shipperId, "ID shipper");
    const normalizedStatus = status ? String(status).trim().toUpperCase() : null;
    const normalizedSearch = search === null || search === undefined ? null : String(search).trim();
    if (normalizedStatus && !ASSIGNMENT_STATUSES.includes(normalizedStatus)) {
        throw new AppError("Trạng thái phân công không hợp lệ.", 400);
    }

    const user = await orderAssignmentModel.findUserForAssignment(normalizedShipperId, null);
    if (!user || user.isDelete === 1) {
        throw new AppError("Tài khoản shipper không tồn tại hoặc đã bị khóa.", 403);
    }
    if (user.role !== "Shipper") {
        throw new AppError("Tài khoản không có role Shipper.", 403);
    }

    const result = await orderAssignmentModel.findForShipper({
        shipperId: normalizedShipperId,
        status: normalizedStatus,
        search: normalizedSearch,
        page,
        limit
    });

    return {
        ...result,
        assignments: result.assignments.map((assignment) => ({
            id: assignment.id,
            orderId: assignment.order_id,
            shipperId: assignment.shipper_id,
            assignedBy: assignment.assigned_by,
            status: assignment.status,
            isActive: Boolean(assignment.isActive),
            assignedAt: assignment.assignedAt,
            acceptedAt: assignment.acceptedAt,
            rejectedAt: assignment.rejectedAt,
            completedAt: assignment.completedAt,
            cancelledAt: assignment.cancelledAt,
            rejectionReason: assignment.rejectionReason,
            cancellationReason: assignment.cancellationReason,
            note: assignment.assignment_note || assignment.note,
            assignmentNote: assignment.assignment_note || assignment.note,
            completionNote: assignment.completion_note,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt,
            order: {
                status: assignment.orderStatus,
                total: assignment.total,
                totalQuantity: assignment.total_quantity,
                paymentMethod: assignment.payment_method,
                shippingInfo: buildShippingInfo(assignment.ghn_info)
            }
        }))
    };
}

async function assignInternalOrderToShipper({ orderId, shipperId, assignedBy, note = null } = {}) {
    const normalizedOrderId = validateId(orderId, "Mã đơn hàng");
    const normalizedShipperId = validateId(shipperId, "ID shipper");
    const normalizedAssignedBy = validateId(assignedBy, "ID người phân công");
    const cleanNote = note === null || note === undefined ? null : String(note).trim();

    if (cleanNote && cleanNote.length > 1000) {
        throw new AppError("Ghi chú phân công không được vượt quá 1000 ký tự.", 400);
    }

    const pool = await orderAssignmentModel.connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const activeAssignment = await orderAssignmentModel.findActiveByOrderId(normalizedOrderId, transaction);
        if (activeAssignment) {
            throw new AppError("Đơn hàng đã có một phân công đang hoạt động.", 409);
        }

        const order = await orderAssignmentModel.findOrderForAssignment(normalizedOrderId, transaction);
        if (!order) {
            throw new AppError("Không tìm thấy đơn hàng.", 404);
        }

        const ghnInfo = parseGhnInfo(order.ghn_info);
        if (!isInternalDeliveryType(ghnInfo.deliveryType)) {
            throw new AppError("Chỉ đơn giao nội thành TP.HCM mới được phân công cho shipper nội bộ.", 400);
        }

        if (Number(order.status) !== 1) {
            throw new AppError("Chỉ đơn đã xác nhận hoặc đã thanh toán mới được phân công.", 400);
        }

        const shipper = await orderAssignmentModel.findUserForAssignment(normalizedShipperId, transaction);
        if (!shipper || shipper.isDelete === 1) {
            throw new AppError("Shipper không tồn tại hoặc đã bị khóa.", 404);
        }
        if (shipper.role !== "Shipper") {
            throw new AppError("Tài khoản được chọn không có role Shipper.", 400);
        }

        const assigner = await orderAssignmentModel.findUserForAssignment(normalizedAssignedBy, transaction);
        if (!assigner || assigner.isDelete === 1) {
            throw new AppError("Người phân công không tồn tại hoặc đã bị khóa.", 403);
        }
        if (assigner.role !== "Admin") {
            throw new AppError("Chỉ Admin mới được phân công đơn hàng.", 403);
        }

        const assignment = await orderAssignmentModel.create({
            id: uuidv4(),
            orderId: normalizedOrderId,
            shipperId: normalizedShipperId,
            assignedBy: normalizedAssignedBy,
            note: cleanNote || null
        }, transaction);

        await transaction.commit();
        return assignment;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            void error;
        }
        orderAssignmentModel.handleAssignmentWriteError(error);
    }
}

async function updateAssignmentByShipper({ assignmentId, shipperId, action, rejectionReason = null } = {}) {
    const normalizedAssignmentId = validateId(assignmentId, "Mã phân công");
    const normalizedShipperId = validateId(shipperId, "ID shipper");
    const normalizedAction = String(action || "").trim().toUpperCase();
    if (!["ACCEPT", "REJECT"].includes(normalizedAction)) {
        throw new AppError("Thao tác phân công không hợp lệ.", 400);
    }

    const reason = rejectionReason === null || rejectionReason === undefined ? "" : String(rejectionReason).trim();
    if (normalizedAction === "REJECT" && !reason) {
        throw new AppError("Lý do từ chối nhận đơn không được để trống.", 400);
    }
    if (reason.length > 500) {
        throw new AppError("Lý do từ chối không được vượt quá 500 ký tự.", 400);
    }

    const pool = await orderAssignmentModel.connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const assignment = await orderAssignmentModel.findAssignmentWithOrderForUpdate(normalizedAssignmentId, transaction);
        if (!assignment) {
            throw new AppError("Không tìm thấy phân công.", 404);
        }
        if (assignment.shipper_id !== normalizedShipperId) {
            throw new AppError("Bạn không có quyền thao tác phân công này.", 403);
        }
        if (assignment.status !== "ASSIGNED" || !assignment.isActive) {
            throw new AppError("Phân công không còn ở trạng thái chờ xử lý.", 409);
        }

        const shipper = await orderAssignmentModel.findUserForAssignment(normalizedShipperId, transaction);
        if (!shipper || shipper.isDelete === 1 || shipper.role !== "Shipper") {
            throw new AppError("Tài khoản shipper không tồn tại, đã bị khóa hoặc không còn quyền Shipper.", 403);
        }

        if (normalizedAction === "ACCEPT") {
            if (Number(assignment.orderStatus) !== 1) {
                throw new AppError("Đơn hàng không còn ở trạng thái sẵn sàng giao.", 409);
            }
            if (!isInternalDeliveryType(parseGhnInfo(assignment.ghn_info).deliveryType)) {
                throw new AppError("Chỉ đơn giao nội thành mới được shipper nội bộ nhận.", 409);
            }
            const updatedOrder = await orderAssignmentModel.updateOrderToShipping(assignment.order_id, transaction);
            if (!updatedOrder) {
                throw new AppError("Trạng thái đơn hàng đã thay đổi, vui lòng tải lại.", 409);
            }
        }

        const updated = normalizedAction === "ACCEPT"
            ? await orderAssignmentModel.updateAccepted(normalizedAssignmentId, normalizedShipperId, transaction)
            : await orderAssignmentModel.updateRejected(normalizedAssignmentId, normalizedShipperId, reason, transaction);
        if (!updated) {
            throw new AppError("Phân công đã được xử lý bởi thao tác khác.", 409);
        }

        await transaction.commit();
        return updated;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            void error;
        }
        orderAssignmentModel.handleAssignmentWriteError(error);
    }
}

async function completeAssignment({ assignmentId, shipperId, note = null, codCollected = false } = {}) {
    const normalizedAssignmentId = validateId(assignmentId, "Mã phân công");
    const normalizedShipperId = validateId(shipperId, "ID shipper");
    const cleanNote = note === null || note === undefined ? null : String(note).trim();
    if (cleanNote && cleanNote.length > 1000) {
        throw new AppError("Ghi chú hoàn tất giao hàng không được vượt quá 1000 ký tự.", 400);
    }

    const pool = await orderAssignmentModel.connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const assignment = await orderAssignmentModel.findAssignmentWithOrderForUpdate(normalizedAssignmentId, transaction);
        if (!assignment) {
            throw new AppError("Không tìm thấy phân công.", 404);
        }
        if (assignment.shipper_id !== normalizedShipperId) {
            throw new AppError("Bạn không có quyền thao tác phân công này.", 403);
        }
        if (assignment.status !== "ACCEPTED" || !assignment.isActive) {
            throw new AppError("Chỉ phân công đã được nhận mới có thể hoàn tất.", 409);
        }

        const shipper = await orderAssignmentModel.findUserForAssignment(normalizedShipperId, transaction);
        if (!shipper || shipper.isDelete === 1 || shipper.role !== "Shipper") {
            throw new AppError("Tài khoản shipper không tồn tại, đã bị khóa hoặc không còn quyền Shipper.", 403);
        }
        if (Number(assignment.orderStatus) !== 2) {
            throw new AppError("Đơn hàng không còn ở trạng thái đang giao.", 409);
        }
        if (String(assignment.payment_method || "").toUpperCase() === "COD" && codCollected !== true) {
            throw new AppError("Vui lòng xác nhận đã thu đủ tiền COD trước khi hoàn tất đơn.", 400);
        }

        const updatedOrder = await orderAssignmentModel.updateOrderToDelivered(assignment.order_id, transaction);
        if (!updatedOrder) {
            throw new AppError("Trạng thái đơn hàng đã thay đổi, vui lòng tải lại.", 409);
        }
        const updated = await orderAssignmentModel.updateCompleted(normalizedAssignmentId, normalizedShipperId, cleanNote || null, transaction);
        if (!updated) {
            throw new AppError("Phân công đã được xử lý bởi thao tác khác.", 409);
        }

        await transaction.commit();
        return updated;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            void error;
        }
        orderAssignmentModel.handleAssignmentWriteError(error);
    }
}

module.exports = {
    assignInternalOrderToShipper,
    getAssignmentsForShipper,
    updateAssignmentByShipper,
    completeAssignment
};
