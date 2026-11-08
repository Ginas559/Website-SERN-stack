const { v4: uuidv4 } = require("uuid");
const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");
const orderItemModel = require("./orderItemModel");

const orderColumns = "id, user_id, total, total_quantity, status, pay_url, discount, payment_method, ghn_info, ghn_response, ghn_code, ghn_fee, createdAt, updatedAt";
const insertedOrderColumns = "INSERTED.id, INSERTED.user_id, INSERTED.total, INSERTED.total_quantity, INSERTED.status, INSERTED.pay_url, INSERTED.discount, INSERTED.payment_method, INSERTED.ghn_info, INSERTED.ghn_response, INSERTED.ghn_code, INSERTED.ghn_fee, INSERTED.createdAt, INSERTED.updatedAt";

function handleOrderWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Mã đơn hàng đã tồn tại.", 409, error);
    }
    if (error && error.number === 547) {
        throw new AppError("Ràng buộc dữ liệu đơn hàng không hợp lệ (người dùng không tồn tại).", 400, error);
    }
    throw error;
}

async function create(orderData, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const orderId = orderData.id || uuidv4();
        const req = new sql.Request(executor);
        const result = await req
            .input("id", sql.Char(36), orderId)
            .input("user_id", sql.Char(36), orderData.userId || orderData.user_id || null)
            .input("total", sql.Int, Math.max(0, Number(orderData.total) || 0))
            .input("total_quantity", sql.Int, Math.max(0, Number(orderData.totalQuantity || orderData.total_quantity) || 0))
            .input("status", sql.Int, Number.isInteger(orderData.status) ? orderData.status : 0)
            .input("pay_url", sql.VarChar(1000), orderData.payUrl || orderData.pay_url || null)
            .input("discount", sql.Int, orderData.discount !== undefined && orderData.discount !== null ? Number(orderData.discount) : null)
            .input("payment_method", sql.VarChar(50), orderData.paymentMethod || orderData.payment_method || "COD")
            .input("ghn_info", sql.NVarChar(sql.MAX), typeof orderData.ghnInfo === "object" ? JSON.stringify(orderData.ghnInfo) : (orderData.ghnInfo || null))
            .input("ghn_response", sql.NVarChar(sql.MAX), typeof orderData.ghnResponse === "object" ? JSON.stringify(orderData.ghnResponse) : (orderData.ghnResponse || null))
            .input("ghn_code", sql.VarChar(255), orderData.ghnCode || orderData.ghn_code || null)
            .input("ghn_fee", sql.Int, Math.max(0, Number(orderData.ghnFee || orderData.ghn_fee) || 0))
            .query(`INSERT INTO dbo.orders (id, user_id, total, total_quantity, status, pay_url, discount, payment_method, ghn_info, ghn_response, ghn_code, ghn_fee, createdAt, updatedAt)
                    OUTPUT ${insertedOrderColumns}
                    VALUES (@id, @user_id, @total, @total_quantity, @status, @pay_url, @discount, @payment_method, @ghn_info, @ghn_response, @ghn_code, @ghn_fee, GETDATE(), GETDATE())`);

        return result.recordset[0];
    } catch (error) {
        handleOrderWriteError(error);
    }
}

async function createWithItems(orderData, items = [], externalTransaction = null) {
    const pool = await connectDB();
    const isInternal = !externalTransaction;
    const tx = externalTransaction || new sql.Transaction(pool);

    if (isInternal) await tx.begin();

    try {
        const createdOrder = await create(orderData, tx);
        const createdItems = await orderItemModel.createMany(createdOrder.id, items, tx);

        if (isInternal) await tx.commit();
        return { ...createdOrder, items: createdItems };
    } catch (error) {
        if (isInternal) {
            try { await tx.rollback(); } catch { return; }
        }
        throw error;
    }
}

async function findById(id, { includeItems = true } = {}) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query(`SELECT ${orderColumns} FROM dbo.orders WHERE id = @id`);

    const order = result.recordset[0];
    if (!order) return null;

    let items = [];
    if (includeItems) {
        items = await orderItemModel.findByOrderId(id);
    }
    return { ...order, items };
}

async function findByUserId(userId, { page = 1, limit = 10, status = null } = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    let whereSql = "WHERE user_id = @user_id";
    if (status !== null && status !== undefined && status !== "") whereSql += " AND status = @status";

    const countReq = pool.request().input("user_id", sql.Char(36), userId);
    if (status !== null && status !== undefined && status !== "") countReq.input("status", sql.Int, Number(status));
    const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.orders ${whereSql}`);
    const total = countRes.recordset[0].total;

    const listReq = pool.request()
        .input("user_id", sql.Char(36), userId)
        .input("offset", sql.Int, offset)
        .input("limit", sql.Int, safeLimit);
    if (status !== null && status !== undefined && status !== "") listReq.input("status", sql.Int, Number(status));

    const listRes = await listReq.query(`SELECT ${orderColumns} FROM dbo.orders ${whereSql}
                                         ORDER BY createdAt DESC
                                         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return { orders: listRes.recordset, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
}

async function updateStatus(id, nextStatus, expectedCurrentStatus = null, transaction = null) {
    const safeNext = Number(nextStatus);
    if (expectedCurrentStatus !== null && expectedCurrentStatus !== undefined && Number(expectedCurrentStatus) === safeNext) {
        return await findById(id, { includeItems: false });
    }

    const pool = await connectDB();
    const executor = transaction || pool;
    let query = `UPDATE dbo.orders SET status = @nextStatus, updatedAt = GETDATE()
                 OUTPUT ${insertedOrderColumns} WHERE id = @id`;

    const req = new sql.Request(executor)
        .input("id", sql.Char(36), id)
        .input("nextStatus", sql.Int, Number(nextStatus));

    if (expectedCurrentStatus !== null && expectedCurrentStatus !== undefined) {
        query += " AND status = @expectedCurrentStatus";
        req.input("expectedCurrentStatus", sql.Int, Number(expectedCurrentStatus));
    }

    const result = await req.query(query);
    const updated = result.recordset[0];
    if (!updated) {
        throw new AppError("Trạng thái đơn hàng đã thay đổi hoặc không tìm thấy đơn hàng, vui lòng thử lại.", 409);
    }
    return updated;
}

async function updatePaymentUrl(id, payUrl, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;
    const result = await new sql.Request(executor)
        .input("id", sql.Char(36), id)
        .input("pay_url", sql.VarChar(1000), payUrl)
        .query(`UPDATE dbo.orders SET pay_url = @pay_url, updatedAt = GETDATE()
                OUTPUT ${insertedOrderColumns} WHERE id = @id`);
    const updated = result.recordset[0];
    if (!updated) {
        throw new AppError("Không tìm thấy đơn hàng để cập nhật URL thanh toán.", 404);
    }
    return updated;
}

async function updatePaymentSuccess(id, { ghnResponse = null, ghnInfo = null } = {}, transaction = null) {
    const current = await findById(id, { includeItems: false });
    if (!current) {
        throw new AppError("Không tìm thấy đơn hàng để cập nhật thanh toán.", 404);
    }
    if (Number(current.status) === 1) {
        return current;
    }
    if (Number(current.status) !== 0) {
        throw new AppError("Đơn hàng không ở trạng thái chờ thanh toán.", 409);
    }

    let mergedGhnInfo = ghnInfo;
    if (ghnInfo && typeof ghnInfo === "object") {
        let currentInfo = current.ghn_info;
        if (typeof currentInfo === "string") {
            try { currentInfo = JSON.parse(currentInfo); } catch { currentInfo = {}; }
        }
        mergedGhnInfo = {
            ...(currentInfo || {}),
            ...ghnInfo
        };
    }

    const pool = await connectDB();
    const executor = transaction || pool;
    const req = new sql.Request(executor)
        .input("id", sql.Char(36), id)
        .input("ghn_response", sql.NVarChar(sql.MAX), typeof ghnResponse === "object" ? JSON.stringify(ghnResponse) : ghnResponse)
        .input("ghn_info", sql.NVarChar(sql.MAX), typeof mergedGhnInfo === "object" ? JSON.stringify(mergedGhnInfo) : mergedGhnInfo);

    const result = await req.query(`UPDATE dbo.orders 
                                    SET status = 1,
                                        ghn_response = ISNULL(@ghn_response, ghn_response),
                                        ghn_info = ISNULL(@ghn_info, ghn_info),
                                        updatedAt = GETDATE()
                                    OUTPUT ${insertedOrderColumns} 
                                    WHERE id = @id AND status = 0`);
    const updated = result.recordset[0];
    if (!updated) {
        throw new AppError("Trạng thái đơn hàng đã thay đổi hoặc không tìm thấy đơn hàng, vui lòng thử lại.", 409);
    }
    return updated;
}

async function recordPaymentFailure(id, { ghnResponse = null } = {}, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;
    const req = new sql.Request(executor)
        .input("id", sql.Char(36), id)
        .input("ghn_response", sql.NVarChar(sql.MAX), typeof ghnResponse === "object" ? JSON.stringify(ghnResponse) : ghnResponse);

    const result = await req.query(`UPDATE dbo.orders 
                                    SET ghn_response = ISNULL(@ghn_response, ghn_response),
                                        updatedAt = GETDATE()
                                    OUTPUT ${insertedOrderColumns} 
                                    WHERE id = @id`);
    return result.recordset[0] || null;
}

async function findAllForAdmin({
    page = 1,
    limit = 10,
    search = null,
    status = null,
    paymentMethod = null,
    fromDate = null,
    toDate = null,
    sortBy = "createdAt",
    sortOrder = "DESC"
} = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    const conditions = [];
    const countReq = pool.request();
    const listReq = pool.request();

    if (search && typeof search === "string" && search.trim() !== "") {
        const cleanSearch = `%${search.trim()}%`;
        conditions.push(`(
            o.id LIKE @search 
            OR u.full_name LIKE @search 
            OR u.email LIKE @search 
            OR u.phone_number LIKE @search 
            OR o.ghn_code LIKE @search 
            OR o.ghn_info LIKE @search
        )`);
        countReq.input("search", sql.NVarChar(255), cleanSearch);
        listReq.input("search", sql.NVarChar(255), cleanSearch);
    }

    if (status !== null && status !== undefined && status !== "") {
        conditions.push("o.status = @status");
        countReq.input("status", sql.Int, Number(status));
        listReq.input("status", sql.Int, Number(status));
    }

    if (paymentMethod && typeof paymentMethod === "string" && paymentMethod.trim() !== "") {
        conditions.push("o.payment_method = @paymentMethod");
        countReq.input("paymentMethod", sql.VarChar(50), paymentMethod.trim().toUpperCase());
        listReq.input("paymentMethod", sql.VarChar(50), paymentMethod.trim().toUpperCase());
    }

    if (fromDate) {
        conditions.push("o.createdAt >= @fromDate");
        countReq.input("fromDate", sql.DateTime, new Date(fromDate));
        listReq.input("fromDate", sql.DateTime, new Date(fromDate));
    }

    if (toDate) {
        conditions.push("o.createdAt <= @toDate");
        countReq.input("toDate", sql.DateTime, new Date(toDate));
        listReq.input("toDate", sql.DateTime, new Date(toDate));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const allowedSortFields = {
        createdAt: "o.createdAt",
        total: "o.total",
        total_quantity: "o.total_quantity",
        status: "o.status"
    };
    const orderCol = allowedSortFields[sortBy] || "o.createdAt";
    const dir = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    const countQuery = `
        SELECT COUNT(*) AS total 
        FROM dbo.orders o
        LEFT JOIN dbo.Users u ON o.user_id = u.id
        ${whereClause}
    `;
    const countResult = await countReq.query(countQuery);
    const total = countResult.recordset[0].total;

    listReq.input("offset", sql.Int, offset);
    listReq.input("limit", sql.Int, safeLimit);

    const listQuery = `
        SELECT 
            o.id,
            o.user_id,
            o.total,
            o.total_quantity,
            o.status,
            o.pay_url,
            o.discount,
            o.payment_method,
            o.ghn_info,
            o.ghn_response,
            o.ghn_code,
            o.ghn_fee,
            o.createdAt,
            o.updatedAt,
            u.full_name AS customer_name,
            u.email AS customer_email,
            u.phone_number AS customer_phone
        FROM dbo.orders o
        LEFT JOIN dbo.Users u ON o.user_id = u.id
        ${whereClause}
        ORDER BY ${orderCol} ${dir}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;
    const listResult = await listReq.query(listQuery);

    return {
        orders: listResult.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit)
    };
}

module.exports = {
    create,
    createWithItems,
    findById,
    findByUserId,
    findAllForAdmin,
    updateStatus,
    updatePaymentUrl,
    updatePaymentSuccess,
    recordPaymentFailure,
    handleOrderWriteError
};
