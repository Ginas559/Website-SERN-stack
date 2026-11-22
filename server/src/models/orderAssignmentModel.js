const { sql, connectDB } = require("../config/connectDB");

async function findOrderForAssignment(orderId, transaction) {
    const result = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`SELECT TOP 1 id, status, ghn_info
                FROM dbo.orders WITH (UPDLOCK, HOLDLOCK)
                WHERE id = @orderId`);
    return result.recordset[0] || null;
}

async function findUserForAssignment(userId, transaction) {
    const executor = transaction || await connectDB();
    const result = await new sql.Request(executor)
        .input("userId", sql.Char(36), userId)
        .query(`SELECT TOP 1 id, role, isDelete
                FROM dbo.Users WITH (UPDLOCK, HOLDLOCK)
                WHERE id = @userId`);
    return result.recordset[0] || null;
}

async function findActiveByOrderId(orderId, transaction) {
    const result = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`SELECT TOP 1 id, order_id, shipper_id, assigned_by, status, isActive,
                       assignedAt, acceptedAt, rejectedAt, completedAt, cancelledAt,
                       rejectionReason, cancellationReason, note, assignment_note, completion_note, createdAt, updatedAt
                FROM dbo.order_assignments WITH (UPDLOCK, HOLDLOCK)
                WHERE order_id = @orderId AND isActive = 1`);
    return result.recordset[0] || null;
}

async function create({ id, orderId, shipperId, assignedBy, note = null }, transaction) {
    const result = await new sql.Request(transaction)
        .input("id", sql.Char(36), id)
        .input("orderId", sql.Char(36), orderId)
        .input("shipperId", sql.Char(36), shipperId)
        .input("assignedBy", sql.Char(36), assignedBy)
        .input("note", sql.NVarChar(1000), note)
        .query(`INSERT INTO dbo.order_assignments (id, order_id, shipper_id, assigned_by, status, isActive, note, assignment_note)
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.shipper_id, INSERTED.assigned_by,
                       INSERTED.status, INSERTED.isActive, INSERTED.assignedAt, INSERTED.acceptedAt,
                       INSERTED.rejectedAt, INSERTED.completedAt, INSERTED.cancelledAt,
                       INSERTED.rejectionReason, INSERTED.cancellationReason, INSERTED.note, INSERTED.assignment_note, INSERTED.completion_note, INSERTED.createdAt, INSERTED.updatedAt
                VALUES (@id, @orderId, @shipperId, @assignedBy, 'ASSIGNED', 1, @note, @note)`);
    return result.recordset[0] || null;
}

async function findForShipper({ shipperId, status = null, search = null, page = 1, limit = 20 } = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;
    const whereClauses = ["oa.shipper_id = @shipperId"];
    const countRequest = pool.request().input("shipperId", sql.Char(36), shipperId);
    const listRequest = pool.request().input("shipperId", sql.Char(36), shipperId);

    if (status) {
        whereClauses.push("oa.status = @status");
        countRequest.input("status", sql.VarChar(20), status);
        listRequest.input("status", sql.VarChar(20), status);
    }

    if (search) {
        const searchPattern = `%${search}%`;
        const searchClause = `(
            oa.id LIKE @searchPattern
            OR oa.order_id LIKE @searchPattern
            OR oa.note LIKE @searchPattern
            OR oa.assignment_note LIKE @searchPattern
            OR oa.completion_note LIKE @searchPattern
            OR oa.rejectionReason LIKE @searchPattern
            OR oa.cancellationReason LIKE @searchPattern
            OR JSON_VALUE(o.ghn_info, '$.receiverName') LIKE @searchPattern
            OR JSON_VALUE(o.ghn_info, '$.phone') LIKE @searchPattern
            OR JSON_VALUE(o.ghn_info, '$.address') LIKE @searchPattern
        )`;
        whereClauses.push(searchClause);
        countRequest.input("searchPattern", sql.NVarChar(110), searchPattern);
        listRequest.input("searchPattern", sql.NVarChar(110), searchPattern);
    }

    const whereSql = whereClauses.join(" AND ");
    const countResult = await countRequest.query(`SELECT COUNT(*) AS total
                                                   FROM dbo.order_assignments oa
                                                   INNER JOIN dbo.orders o ON o.id = oa.order_id
                                                   WHERE ${whereSql}`);
    const total = Number(countResult.recordset[0]?.total || 0);

    const listResult = await listRequest
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit)
        .query(`SELECT oa.id, oa.order_id, oa.shipper_id, oa.assigned_by, oa.status, oa.isActive,
                       oa.assignedAt, oa.acceptedAt, oa.rejectedAt, oa.completedAt, oa.cancelledAt,
                       oa.rejectionReason, oa.cancellationReason, oa.note, oa.assignment_note, oa.completion_note, oa.createdAt, oa.updatedAt,
                       o.status AS orderStatus, o.total, o.total_quantity, o.payment_method,
                       o.ghn_info
                FROM dbo.order_assignments oa
                INNER JOIN dbo.orders o ON o.id = oa.order_id
                WHERE ${whereSql}
                ORDER BY oa.assignedAt DESC, oa.id DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return {
        assignments: listResult.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1
    };
}

async function findAssignmentWithOrderForUpdate(assignmentId, transaction) {
    const result = await new sql.Request(transaction)
        .input("assignmentId", sql.Char(36), assignmentId)
        .query(`SELECT TOP 1 oa.id, oa.order_id, oa.shipper_id, oa.assigned_by, oa.status, oa.isActive,
                       oa.assignedAt, oa.acceptedAt, oa.rejectedAt, oa.completedAt, oa.cancelledAt,
                       oa.rejectionReason, oa.cancellationReason, oa.note, oa.assignment_note, oa.completion_note, oa.createdAt, oa.updatedAt,
                        o.status AS orderStatus, o.payment_method, o.ghn_info
                FROM dbo.order_assignments oa WITH (UPDLOCK, HOLDLOCK)
                INNER JOIN dbo.orders o WITH (UPDLOCK, HOLDLOCK) ON o.id = oa.order_id
                WHERE oa.id = @assignmentId`);
    return result.recordset[0] || null;
}

async function updateOrderToShipping(orderId, transaction) {
    const result = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`UPDATE dbo.orders
                SET status = 2, updatedAt = GETDATE()
                OUTPUT INSERTED.id, INSERTED.status
                WHERE id = @orderId AND status = 1`);
    return result.recordset[0] || null;
}

async function updateOrderToDelivered(orderId, transaction) {
    const result = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`UPDATE dbo.orders
                SET status = 3, updatedAt = GETDATE()
                OUTPUT INSERTED.id, INSERTED.status
                WHERE id = @orderId AND status = 2`);
    return result.recordset[0] || null;
}

async function updateAccepted(assignmentId, shipperId, transaction) {
    const result = await new sql.Request(transaction)
        .input("assignmentId", sql.Char(36), assignmentId)
        .input("shipperId", sql.Char(36), shipperId)
        .query(`UPDATE dbo.order_assignments
                SET status = 'ACCEPTED', acceptedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.shipper_id, INSERTED.assigned_by,
                       INSERTED.status, INSERTED.isActive, INSERTED.assignedAt, INSERTED.acceptedAt,
                       INSERTED.rejectedAt, INSERTED.completedAt, INSERTED.cancelledAt,
                       INSERTED.rejectionReason, INSERTED.cancellationReason, INSERTED.note, INSERTED.assignment_note, INSERTED.completion_note, INSERTED.createdAt, INSERTED.updatedAt
                WHERE id = @assignmentId AND shipper_id = @shipperId AND status = 'ASSIGNED' AND isActive = 1`);
    return result.recordset[0] || null;
}

async function updateRejected(assignmentId, shipperId, reason, transaction) {
    const result = await new sql.Request(transaction)
        .input("assignmentId", sql.Char(36), assignmentId)
        .input("shipperId", sql.Char(36), shipperId)
        .input("reason", sql.NVarChar(500), reason)
        .query(`UPDATE dbo.order_assignments
                SET status = 'REJECTED', isActive = 0, rejectedAt = SYSUTCDATETIME(),
                    rejectionReason = @reason, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.shipper_id, INSERTED.assigned_by,
                       INSERTED.status, INSERTED.isActive, INSERTED.assignedAt, INSERTED.acceptedAt,
                       INSERTED.rejectedAt, INSERTED.completedAt, INSERTED.cancelledAt,
                       INSERTED.rejectionReason, INSERTED.cancellationReason, INSERTED.note, INSERTED.assignment_note, INSERTED.completion_note, INSERTED.createdAt, INSERTED.updatedAt
                WHERE id = @assignmentId AND shipper_id = @shipperId AND status = 'ASSIGNED' AND isActive = 1`);
    return result.recordset[0] || null;
}

async function updateCompleted(assignmentId, shipperId, note, transaction) {
    const result = await new sql.Request(transaction)
        .input("assignmentId", sql.Char(36), assignmentId)
        .input("shipperId", sql.Char(36), shipperId)
        .input("note", sql.NVarChar(1000), note)
        .query(`UPDATE dbo.order_assignments
                SET status = 'COMPLETED', isActive = 0, completedAt = SYSUTCDATETIME(),
                    completion_note = CASE WHEN @note IS NULL THEN completion_note ELSE @note END,
                    updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.shipper_id, INSERTED.assigned_by,
                       INSERTED.status, INSERTED.isActive, INSERTED.assignedAt, INSERTED.acceptedAt,
                       INSERTED.rejectedAt, INSERTED.completedAt, INSERTED.cancelledAt,
                       INSERTED.rejectionReason, INSERTED.cancellationReason, INSERTED.note, INSERTED.assignment_note, INSERTED.completion_note, INSERTED.createdAt, INSERTED.updatedAt
                WHERE id = @assignmentId AND shipper_id = @shipperId AND status = 'ACCEPTED' AND isActive = 1`);
    return result.recordset[0] || null;
}

async function cancelActiveByOrderId(orderId, reason, transaction) {
    const currentResult = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`SELECT TOP 1 id, status
                FROM dbo.order_assignments WITH (UPDLOCK, HOLDLOCK)
                WHERE order_id = @orderId AND isActive = 1`);
    const current = currentResult.recordset[0] || null;
    if (!current) return null;
    if (current.status === "ACCEPTED") return { blocked: true, assignment: current };

    const result = await new sql.Request(transaction)
        .input("assignmentId", sql.Char(36), current.id)
        .input("reason", sql.NVarChar(500), reason)
        .query(`UPDATE dbo.order_assignments
                SET status = 'CANCELLED', isActive = 0, cancelledAt = SYSUTCDATETIME(),
                    cancellationReason = @reason, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.shipper_id, INSERTED.assigned_by,
                       INSERTED.status, INSERTED.isActive, INSERTED.assignedAt, INSERTED.acceptedAt,
                       INSERTED.rejectedAt, INSERTED.completedAt, INSERTED.cancelledAt,
                       INSERTED.rejectionReason, INSERTED.cancellationReason, INSERTED.note, INSERTED.assignment_note, INSERTED.completion_note, INSERTED.createdAt, INSERTED.updatedAt
                WHERE id = @assignmentId AND isActive = 1 AND status = 'ASSIGNED'`);
    return { blocked: false, assignment: result.recordset[0] || null };
}

async function cancelActiveByShipperId(shipperId, reason, transaction) {
    const result = await new sql.Request(transaction)
        .input("shipperId", sql.Char(36), shipperId)
        .input("reason", sql.NVarChar(500), reason)
        .query(`UPDATE dbo.order_assignments
                SET status = 'CANCELLED', isActive = 0, cancelledAt = SYSUTCDATETIME(),
                    cancellationReason = @reason, updatedAt = SYSUTCDATETIME()
                OUTPUT INSERTED.id, INSERTED.order_id, INSERTED.status
                WHERE shipper_id = @shipperId AND isActive = 1 AND status = 'ASSIGNED'`);
    return result.recordset;
}

async function findActiveAcceptedByShipperId(shipperId, transaction = null) {
    const executor = transaction || await connectDB();
    const request = new sql.Request(executor)
        .input("shipperId", sql.Char(36), shipperId)
    const result = await request.query(`SELECT TOP 1 id, order_id
                FROM dbo.order_assignments WITH (UPDLOCK, HOLDLOCK)
                WHERE shipper_id = @shipperId AND isActive = 1 AND status = 'ACCEPTED'`);
    return result.recordset[0] || null;
}

async function findLatestByOrderIdForUpdate(orderId, transaction) {
    const result = await new sql.Request(transaction)
        .input("orderId", sql.Char(36), orderId)
        .query(`SELECT TOP 1 id, order_id, shipper_id, status, isActive, assignedAt,
                       acceptedAt, completedAt, cancelledAt
                FROM dbo.order_assignments WITH (UPDLOCK, HOLDLOCK)
                WHERE order_id = @orderId
                ORDER BY createdAt DESC, id DESC`);
    return result.recordset[0] || null;
}

function handleAssignmentWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        const AppError = require("../utils/AppError");
        throw new AppError("Đơn hàng đã có một phân công đang hoạt động.", 409, error);
    }
    throw error;
}

module.exports = {
    connectDB,
    findOrderForAssignment,
    findUserForAssignment,
    findActiveByOrderId,
    create,
    findForShipper,
    findAssignmentWithOrderForUpdate,
    updateOrderToShipping,
    updateOrderToDelivered,
    updateAccepted,
    updateRejected,
    updateCompleted,
    cancelActiveByOrderId,
    cancelActiveByShipperId,
    findActiveAcceptedByShipperId,
    findLatestByOrderIdForUpdate,
    handleAssignmentWriteError
};
