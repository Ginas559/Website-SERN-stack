const { v4: uuidv4 } = require("uuid");
const { sql, connectDB } = require("../config/connectDB");
const orderModel = require("../models/orderModel");
const orderItemModel = require("../models/orderItemModel");
const cartModel = require("../models/cartModel");
const bookModel = require("../models/bookModel");
const paymentService = require("./paymentService");
const discountService = require("./discountService");
const storePolicyService = require("./storePolicyService");
const discountModel = require("../models/discountModel");
const userModel = require("../models/userModel");
const ghnService = require("./ghnService");
const AppError = require("../utils/AppError");
const {
    SUPPORTED_PAYMENT_METHODS,
    calculateDiscountedUnitPrice,
    calculateShippingFee,
    calculateSelectedItemsTotals
} = require("../utils/pricing");

function validatePhoneNumber(phone) {
    let trimmed = typeof phone === "string" ? phone.trim().replace(/\D/g, "") : "";
    if (trimmed.startsWith("84") && trimmed.length === 11) {
        trimmed = "0" + trimmed.slice(2);
    }
    const phoneRegex = /^0[3|5|7|8|9]\d{8}$/;
    if (!trimmed || !phoneRegex.test(trimmed)) {
        throw new AppError("Số điện thoại nhận hàng không hợp lệ (yêu cầu 10 chữ số).", 400);
    }
    return trimmed;
}

function validateReceiverName(name) {
    const trimmed = typeof name === "string" ? name.trim() : "";
    if (!trimmed) {
        throw new AppError("Họ tên người nhận không được để trống.", 400);
    }
    if (trimmed.length > 100) {
        throw new AppError("Họ tên người nhận không được vượt quá 100 ký tự.", 400);
    }
    return trimmed;
}

function validateAddress(address) {
    const trimmed = typeof address === "string" ? address.trim() : "";
    if (!trimmed) {
        throw new AppError("Địa chỉ nhận hàng không được để trống.", 400);
    }
    if (trimmed.length > 255) {
        throw new AppError("Địa chỉ nhận hàng không được vượt quá 255 ký tự.", 400);
    }
    return trimmed;
}


async function createOrderFromCart(userId, orderPayload = {}) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const receiverName = validateReceiverName(orderPayload.receiverName || orderPayload.fullName || orderPayload.recipientName || orderPayload.recipient_name || orderPayload.customerName);
    const phone = validatePhoneNumber(orderPayload.phone || orderPayload.phoneNumber || orderPayload.recipientPhone || orderPayload.recipient_phone);
    const address = validateAddress(orderPayload.address || orderPayload.shippingAddress || orderPayload.shipping_address);
    const note = orderPayload.note && typeof orderPayload.note === "string" ? orderPayload.note.trim().slice(0, 500) : null;
    const rawPaymentMethod = orderPayload.paymentMethod === undefined || orderPayload.paymentMethod === null || orderPayload.paymentMethod === ""
        ? "COD"
        : String(orderPayload.paymentMethod).trim().toUpperCase();
    if (!SUPPORTED_PAYMENT_METHODS.includes(rawPaymentMethod)) {
        throw new AppError("Phương thức thanh toán không hợp lệ (hiện chỉ hỗ trợ COD hoặc VNPAY).", 400);
    }
    const paymentMethod = rawPaymentMethod;

    const cart = await cartModel.findByUserId(userId);
    if (!cart) {
        throw new AppError("Giỏ hàng không tồn tại.", 404);
    }

    const cartDetails = await cartModel.getCartDetails(cart.id);
    if (!cartDetails || cartDetails.length === 0) {
        throw new AppError("Giỏ hàng của bạn đang trống, không thể tạo đơn hàng.", 400);
    }

    let targetItems = cartDetails;
    if (Array.isArray(orderPayload.selectedBookIds) && orderPayload.selectedBookIds.length > 0) {
        const cartBookIds = new Set(cartDetails.map((item) => Number(item.book_id)));
        for (const id of orderPayload.selectedBookIds) {
            const numId = Number(id);
            if (!cartBookIds.has(numId)) {
                throw new AppError(`Sản phẩm với mã ID ${id} không có trong giỏ hàng của bạn.`, 400);
            }
        }
        const selectedSet = new Set(orderPayload.selectedBookIds.map((id) => Number(id)));
        targetItems = cartDetails.filter((item) => selectedSet.has(Number(item.book_id)));
    }

    for (const item of targetItems) {
        if (item.book_is_deleted === 1) {
            throw new AppError(`Ấn phẩm "${item.title || item.book_id}" đã ngừng kinh doanh.`, 400);
        }
        const stock = Math.max(0, Number(item.stock_quantity) || 0);
        const requestedQuantity = Math.max(1, Number(item.quantity) || 1);
        if (stock <= 0) {
            throw new AppError(`Ấn phẩm "${item.title}" tạm thời hết hàng.`, 400);
        }
        if (requestedQuantity > stock) {
            throw new AppError(`Ấn phẩm "${item.title}" chỉ còn ${stock} cuốn trong kho (bạn đặt ${requestedQuantity} cuốn).`, 400);
        }
    }

    const { subtotal, totalQuantity, lineItems } = calculateSelectedItemsTotals(targetItems);
    const orderItems = lineItems.map(({ bookId, quantity, total }) => ({ bookId, quantity, total }));
    const estimatedWeightGrams = Math.min(20000, Math.max(300, totalQuantity * 350));

    let shippingCalculation;
    if (orderPayload.toDistrictId || orderPayload.provinceId || orderPayload.toWardCode) {
        shippingCalculation = await ghnService.calculateShippingFee({
            toDistrictId: orderPayload.toDistrictId,
            toWardCode: orderPayload.toWardCode,
            provinceId: orderPayload.provinceId,
            provinceName: orderPayload.provinceName,
            weightInGrams: estimatedWeightGrams,
            orderTotal: subtotal
        });
    } else {
        const isHcm = ghnService.isInnerCityHcm(address, null);
        if (!isHcm) {
            throw new AppError("Địa chỉ nhận hàng liên tỉnh cần chọn Quận/Huyện và Phường/Xã để tính phí vận chuyển GHN chính xác.", 400);
        }
        const shippingRule = await storePolicyService.getShippingPolicy();
        const fee = calculateShippingFee(subtotal, shippingRule);
        shippingCalculation = {
            shippingFee: fee,
            deliveryType: "INTERNAL",
            deliveryProvider: "Shop Shipper (Nội thành TP.HCM)",
            estimatedDelivery: "Giao nhanh trong 24 giờ"
        };
    }
    const shippingFee = shippingCalculation.shippingFee;
    if (
        orderPayload.expectedShippingFee !== undefined &&
        orderPayload.expectedShippingFee !== null &&
        orderPayload.expectedShippingFee !== "" &&
        Number(orderPayload.expectedShippingFee) !== shippingFee
    ) {
        const formattedFee = Number(shippingFee).toLocaleString("vi-VN");
        throw new AppError(
            `Phí vận chuyển vừa được hệ thống cập nhật thành ${formattedFee}đ, vui lòng kiểm tra lại tổng thanh toán trước khi xác nhận đặt hàng.`,
            409
        );
    }
    let discountValue = 0;
    let appliedDiscountId = null;
    let appliedCouponCode = null;

    if (orderPayload.couponCode && typeof orderPayload.couponCode === "string" && orderPayload.couponCode.trim()) {
        const cleanCoupon = orderPayload.couponCode.trim().toUpperCase();
        if (cleanCoupon.length > 50) {
            throw new AppError("Mã khuyến mãi không được vượt quá 50 ký tự.", 400);
        }
        const shippingRule = await storePolicyService.getShippingPolicy();
        const promoResult = await discountService.validateAndCalculatePromotion({
            code: cleanCoupon,
            subtotal,
            shippingRule
        });
        discountValue = promoResult.discountAmount;
        appliedDiscountId = promoResult.discount.id;
        appliedCouponCode = promoResult.discount.code;
    }

    const finalTotal = Math.max(0, subtotal + shippingFee - discountValue);
    const orderId = uuidv4();

    let ghnCode = null;
    let ghnResponse = null;
    if (paymentMethod === "COD" && shippingCalculation.deliveryType === "GHN" && orderPayload.toDistrictId && orderPayload.toWardCode) {
        try {
            const ghnOrderRes = await ghnService.createShippingOrder({
                toName: receiverName,
                toPhone: phone,
                toAddress: address,
                toWardCode: orderPayload.toWardCode,
                toDistrictId: orderPayload.toDistrictId,
                weightInGrams: estimatedWeightGrams,
                items: targetItems.map((it) => ({
                    title: it.title,
                    quantity: it.quantity,
                    price: it.price
                })),
                codAmount: finalTotal,
                insuranceValue: finalTotal,
                clientOrderCode: orderId
            });
            ghnCode = ghnOrderRes?.order_code || null;
            ghnResponse = ghnOrderRes;
        } catch {
            ghnCode = `GHN_${orderId.slice(0, 8).toUpperCase()}`;
        }
    }

    const ghnInfo = {
        receiverName,
        recipientName: receiverName,
        fullName: receiverName,
        phone,
        phoneNumber: phone,
        recipientPhone: phone,
        address,
        shippingAddress: address,
        note,
        subtotal,
        shippingFee,
        discountValue,
        couponCode: appliedCouponCode,
        deliveryType: shippingCalculation.deliveryType,
        deliveryProvider: shippingCalculation.deliveryProvider,
        estimatedDelivery: shippingCalculation.estimatedDelivery,
        provinceId: orderPayload.provinceId || null,
        districtId: orderPayload.toDistrictId || null,
        wardCode: orderPayload.toWardCode || null,
        ghnCode
    };

    let payUrl = null;
    if (paymentMethod === "VNPAY") {
        payUrl = paymentService.generatePaymentUrl({ id: orderId, total: finalTotal }, {
            ipAddr: orderPayload.ipAddr,
            returnUrl: orderPayload.returnUrl
        });
    }

    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const createdOrder = await orderModel.create({
            id: orderId,
            userId,
            total: finalTotal,
            totalQuantity,
            status: 0,
            paymentMethod,
            payUrl,
            ghnFee: shippingFee,
            ghnCode,
            ghnResponse,
            discount: appliedDiscountId || null,
            ghnInfo
        }, transaction);

        const createdDetails = await orderItemModel.createMany(createdOrder.id, orderItems, transaction);
        if (appliedDiscountId) {
            const incremented = await discountModel.incrementUsedCount(appliedDiscountId, transaction);
            if (!incremented) {
                throw new AppError("Mã khuyến mãi đã hết lượt sử dụng, vui lòng thử lại.", 400);
            }
        }

        for (const item of orderItems) {
            await bookModel.deductStock(item.bookId, item.quantity, transaction);
        }

        for (const item of targetItems) {
            const delReq = new sql.Request(transaction);
            await delReq
                .input("cart_id", sql.Char(36), cart.id)
                .input("book_id", sql.Int, item.book_id)
                .query("DELETE FROM dbo.cart_details WHERE cart_id = @cart_id AND book_id = @book_id");
        }

        const syncReq = new sql.Request(transaction);
        await syncReq
            .input("cart_id", sql.Char(36), cart.id)
            .query(`UPDATE dbo.carts
                    SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        updatedAt = GETDATE()
                    WHERE id = @cart_id`);

        await transaction.commit();

        if (orderPayload.setAsDefaultAddress || orderPayload.saveAsDefaultAddress) {
            await userModel.updateProfile(userId, {
                fullName: receiverName,
                phoneNumber: phone,
                address
            });
        }

        return {
            ...createdOrder,
            ghn_info: ghnInfo,
            items: createdDetails
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return;
        }
        orderModel.handleOrderWriteError(error);
    }
}

async function cancelOrder(orderId, userId, { reason = null, isAdmin = false, currentStatus = null } = {}) {
    if (!orderId) {
        throw new AppError("Mã đơn hàng không hợp lệ.", 400);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng.", 404);
    }

    if (!isAdmin && order.user_id !== userId) {
        throw new AppError("Bạn không có quyền hủy đơn hàng này.", 403);
    }

    if (!isAdmin && order.payment_method === "VNPAY" && Number(order.status) >= 1) {
        throw new AppError("Đơn hàng đã được thanh toán qua VNPAY. Quý khách vui lòng liên hệ bộ phận Chăm sóc khách hàng để được hỗ trợ đối soát và hoàn tiền.", 400);
    }

    if (currentStatus !== null && currentStatus !== undefined && order.status !== Number(currentStatus)) {
        throw new AppError("Trạng thái đơn hàng đã thay đổi trước đó, vui lòng tải lại danh sách.", 409);
    }

    if (order.status === 4) {
        return order;
    }

    if (order.status === 3) {
        throw new AppError("Đơn hàng đã được giao thành công, không thể hủy.", 400);
    }

    if (order.status === 2 && !isAdmin) {
        throw new AppError("Đơn hàng đang trên đường giao, khách hàng không thể tự hủy.", 400);
    }

    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const expectedCancelStatus = currentStatus !== null && currentStatus !== undefined ? Number(currentStatus) : order.status;
        const updatedOrder = await orderModel.updateStatus(orderId, 4, expectedCancelStatus, transaction);

        let ghnInfoObj = {};
        try {
            ghnInfoObj = typeof updatedOrder.ghn_info === "string" ? JSON.parse(updatedOrder.ghn_info) : (updatedOrder.ghn_info || {});
        } catch {
            ghnInfoObj = {};
        }

        ghnInfoObj.cancelReason = reason || (isAdmin ? "Quản trị viên hủy đơn hàng" : "Khách hàng yêu cầu hủy đơn");
        ghnInfoObj.cancelledAt = new Date().toISOString();
        ghnInfoObj.cancelledBy = isAdmin ? "ADMIN" : "CUSTOMER";

        const updateInfoReq = new sql.Request(transaction);
        await updateInfoReq
            .input("id", sql.Char(36), orderId)
            .input("ghn_info", sql.NVarChar(sql.MAX), JSON.stringify(ghnInfoObj))
            .query("UPDATE dbo.orders SET ghn_info = @ghn_info WHERE id = @id");

        const orderItems = order.items && order.items.length > 0
            ? order.items
            : await orderItemModel.findByOrderId(orderId);

        for (const item of orderItems) {
            await bookModel.restoreStock(item.book_id, item.quantity, transaction);
        }

        if (order.discount) {
            await discountModel.decrementUsedCount(order.discount, transaction);
        }

        await transaction.commit();

        if (order.ghn_code && !order.ghn_code.startsWith("GHN_")) {
            try {
                await ghnService.cancelShippingOrder(order.ghn_code);
            } catch {
                ghnInfoObj.ghnCancelWarning = "Không thể gửi yêu cầu hủy sang GHN, bưu tá cần kiểm tra thủ công.";
            }
        }

        return {
            ...updatedOrder,
            status: 4,
            ghn_info: ghnInfoObj,
            items: orderItems
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return;
        }
        orderModel.handleOrderWriteError(error);
    }
}

async function updateOrderStatus(orderId, nextStatus, { currentStatus = null, note = null } = {}) {
    if (!orderId) {
        throw new AppError("Mã đơn hàng không hợp lệ.", 400);
    }

    const safeNext = Number(nextStatus);
    if (![0, 1, 2, 3, 4].includes(safeNext)) {
        throw new AppError("Mã trạng thái đơn hàng không hợp lệ (0: Chờ xử lý, 1: Đã xác nhận, 2: Đang giao, 3: Đã giao, 4: Đã hủy).", 400);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng.", 404);
    }

    if (currentStatus !== null && currentStatus !== undefined && order.status !== Number(currentStatus)) {
        throw new AppError("Trạng thái đơn hàng đã thay đổi trước đó, vui lòng tải lại danh sách.", 409);
    }

    if (order.status === safeNext) {
        return parseOrderJsonFields(order);
    }

    if (safeNext === 4) {
        return await cancelOrder(orderId, null, { isAdmin: true, reason: note, currentStatus });
    }

    if (order.status === 4) {
        throw new AppError("Đơn hàng đã bị hủy, không thể cập nhật trạng thái khác.", 400);
    }

    if (order.status === 3) {
        throw new AppError("Đơn hàng đã hoàn thành, không thể thay đổi trạng thái.", 400);
    }

    if (safeNext < Number(order.status)) {
        throw new AppError(`Không thể chuyển ngược trạng thái đơn hàng từ [${order.status}] về [${safeNext}].`, 400);
    }

    if (order.payment_method === "VNPAY" && Number(order.status) === 0) {
        throw new AppError("Đơn hàng VNPAY chưa hoàn tất thanh toán, trạng thái sẽ tự động cập nhật khi khách hàng thanh toán qua cổng VNPAY.", 400);
    }

    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const updated = await orderModel.updateStatus(orderId, safeNext, currentStatus !== null ? Number(currentStatus) : order.status, transaction);

        let ghnInfoObj = {};
        try {
            ghnInfoObj = typeof updated.ghn_info === "string" ? JSON.parse(updated.ghn_info) : (updated.ghn_info || {});
        } catch {
            ghnInfoObj = {};
        }

        if (note && typeof note === "string") {
            ghnInfoObj.adminNote = note.trim();
        }
        ghnInfoObj.statusUpdatedAt = new Date().toISOString();

        const noteReq = new sql.Request(transaction);
        await noteReq
            .input("id", sql.Char(36), orderId)
            .input("ghn_info", sql.NVarChar(sql.MAX), JSON.stringify(ghnInfoObj))
            .query("UPDATE dbo.orders SET ghn_info = @ghn_info WHERE id = @id");

        await transaction.commit();
        return {
            ...updated,
            ghn_info: ghnInfoObj,
            items: order.items
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return;
        }
        orderModel.handleOrderWriteError(error);
    }
}

function parseOrderJsonFields(order) {
    if (!order) return null;
    let ghnInfo = order.ghn_info;
    let ghnResponse = order.ghn_response;

    if (typeof ghnInfo === "string") {
        try {
            ghnInfo = JSON.parse(ghnInfo);
        } catch {
            ghnInfo = {};
        }
    }

    if (typeof ghnResponse === "string") {
        try {
            ghnResponse = JSON.parse(ghnResponse);
        } catch {
            ghnResponse = {};
        }
    }

    const info = ghnInfo || {};
    const recipientName = order.recipientName || order.recipient_name || order.receiverName || order.fullName || order.customerName || info.receiverName || info.recipientName || info.fullName || null;
    const recipientPhone = order.recipientPhone || order.recipient_phone || order.phoneNumber || order.phone || info.phone || info.phoneNumber || info.recipientPhone || null;
    const shippingAddress = order.shippingAddress || order.shipping_address || order.address || info.address || info.shippingAddress || null;

    return {
        ...order,
        ghn_info: ghnInfo || null,
        ghn_response: ghnResponse || null,
        recipientName,
        recipient_name: recipientName,
        receiverName: recipientName,
        recipientPhone,
        recipient_phone: recipientPhone,
        phone: recipientPhone,
        phoneNumber: recipientPhone,
        shippingAddress,
        shipping_address: shippingAddress,
        address: shippingAddress
    };
}

async function getUserOrders(userId, { page = 1, limit = 10, status = null } = {}) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    try {
        await releaseExpiredVnpayOrders();
    } catch (err) {
        void err;
    }

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

    let parsedStatus = null;
    if (status !== null && status !== undefined && status !== "") {
        parsedStatus = Number(status);
        if (![0, 1, 2, 3, 4].includes(parsedStatus)) {
            throw new AppError("Mã trạng thái đơn hàng không hợp lệ.", 400);
        }
    }

    const result = await orderModel.findByUserId(userId, {
        page: safePage,
        limit: safeLimit,
        status: parsedStatus
    });

    const orderIds = result.orders.map((o) => o.id);
    const allItems = await orderItemModel.findByOrderIds(orderIds);

    const pool = await connectDB();
    const reviewedRes = await new sql.Request(pool)
        .input("userId", sql.Char(36), userId)
        .query("SELECT DISTINCT book_id FROM dbo.comments WHERE user_id = @userId AND isDelete = 0 AND rate IS NOT NULL");
    const reviewedBookIds = new Set(reviewedRes.recordset.map((r) => Number(r.book_id)));

    const itemsByOrderId = new Map();
    for (const item of allItems) {
        if (!itemsByOrderId.has(item.order_id)) {
            itemsByOrderId.set(item.order_id, []);
        }
        itemsByOrderId.get(item.order_id).push({
            ...item,
            isReviewed: reviewedBookIds.has(Number(item.book_id))
        });
    }

    const enrichedOrders = result.orders.map((order) => {
        const enriched = parseOrderJsonFields(order);
        return {
            ...enriched,
            items: itemsByOrderId.get(order.id) || []
        };
    });

    return {
        orders: enrichedOrders,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
    };
}

async function getOrderDetails(orderId, userId, { isAdmin = false } = {}) {
    if (!orderId) {
        throw new AppError("Mã đơn hàng không hợp lệ.", 400);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng.", 404);
    }

    if (!isAdmin && order.user_id !== userId) {
        throw new AppError("Bạn không có quyền truy cập thông tin đơn hàng này.", 403);
    }

    return parseOrderJsonFields(order);
}

async function getAllOrdersForAdmin(filters = {}) {
    try {
        await releaseExpiredVnpayOrders();
    } catch (err) {
        void err;
    }

    const safePage = Math.max(1, Number(filters.page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(filters.limit) || 10));

    let parsedStatus = null;
    if (filters.status !== null && filters.status !== undefined && filters.status !== "") {
        parsedStatus = Number(filters.status);
        if (![0, 1, 2, 3, 4].includes(parsedStatus)) {
            throw new AppError("Mã trạng thái đơn hàng không hợp lệ.", 400);
        }
    }

    let parsedPaymentMethod = null;
    if (filters.paymentMethod && typeof filters.paymentMethod === "string") {
        const cleanPm = filters.paymentMethod.trim().toUpperCase();
        if (!SUPPORTED_PAYMENT_METHODS.includes(cleanPm)) {
            throw new AppError("Phương thức thanh toán không hợp lệ.", 400);
        }
        parsedPaymentMethod = cleanPm;
    }

    const result = await orderModel.findAllForAdmin({
        page: safePage,
        limit: safeLimit,
        search: filters.search || null,
        status: parsedStatus,
        paymentMethod: parsedPaymentMethod,
        fromDate: filters.fromDate || null,
        toDate: filters.toDate || null,
        sortBy: filters.sortBy || "createdAt",
        sortOrder: filters.sortOrder || "DESC"
    });

    const orderIds = result.orders.map((o) => o.id);
    const allItems = await orderItemModel.findByOrderIds(orderIds);

    const itemsByOrderId = new Map();
    for (const item of allItems) {
        if (!itemsByOrderId.has(item.order_id)) {
            itemsByOrderId.set(item.order_id, []);
        }
        itemsByOrderId.get(item.order_id).push(item);
    }

    const enrichedOrders = result.orders.map((order) => {
        const enriched = parseOrderJsonFields(order);
        return {
            ...enriched,
            items: itemsByOrderId.get(order.id) || []
        };
    });

    return {
        orders: enrichedOrders,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages
    };
}

async function reorder(orderId, userId) {
    if (!orderId) {
        throw new AppError("Mã đơn hàng không hợp lệ.", 400);
    }
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng.", 404);
    }

    if (order.user_id !== userId) {
        throw new AppError("Bạn không có quyền mua lại đơn hàng này.", 403);
    }

    const orderItems = order.items && order.items.length > 0
        ? order.items
        : await orderItemModel.findByOrderId(orderId);

    if (!orderItems || orderItems.length === 0) {
        throw new AppError("Đơn hàng không có sản phẩm nào để mua lại.", 400);
    }

    const cart = await cartModel.getOrCreateCart(userId);
    const existingCartDetails = await cartModel.getCartDetails(cart.id);
    const existingCartMap = new Map();
    for (const d of existingCartDetails) {
        existingCartMap.set(Number(d.book_id), d);
    }

    const pool = await connectDB();
    const warnings = [];
    const itemsToAdd = [];

    for (const item of orderItems) {
        const bookId = Number(item.book_id);
        const book = await bookModel.findById(bookId);

        if (!book || book.isDelete === 1) {
            warnings.push(`Ấn phẩm "${item.title || bookId}" đã ngừng kinh doanh, không thể thêm vào giỏ hàng.`);
            continue;
        }

        const currentStock = Math.max(0, Number(book.quantity) || 0);
        if (currentStock <= 0) {
            warnings.push(`Ấn phẩm "${book.title}" tạm thời hết hàng, không thể thêm vào giỏ hàng.`);
            continue;
        }

        const existingItem = existingCartMap.get(bookId);
        const existingQty = existingItem ? Number(existingItem.quantity) || 0 : 0;
        const requestedQty = Number(item.quantity) || 1;

        if (existingQty >= requestedQty) {
            warnings.push(`Ấn phẩm "${book.title}" đã có sẵn trong giỏ hàng (${existingQty} cuốn).`);
            continue;
        }

        let targetQty = Math.max(existingQty, requestedQty);
        if (targetQty > currentStock) {
            targetQty = currentStock;
            warnings.push(`Ấn phẩm "${book.title}" chỉ còn ${currentStock} cuốn trong kho, đã tự động điều chỉnh số lượng.`);
        }

        if (targetQty <= existingQty) {
            warnings.push(`Số lượng ấn phẩm "${book.title}" trong giỏ đã đạt mức tối đa hiện có (${currentStock} cuốn).`);
            continue;
        }

        const unitPrice = calculateDiscountedUnitPrice(book.price, book.discount);
        const lineTotal = unitPrice * targetQty;

        itemsToAdd.push({
            bookId,
            quantity: targetQty,
            total: lineTotal,
            isExisting: Boolean(existingItem)
        });
    }

    if (itemsToAdd.length === 0) {
        return {
            success: true,
            message: "Tất cả sản phẩm từ đơn hàng này đã có sẵn trong giỏ hàng của bạn.",
            warnings: warnings.length > 0 ? warnings : ["Sản phẩm đã có sẵn trong giỏ hàng."]
        };
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        for (const item of itemsToAdd) {
            const req = new sql.Request(transaction);
            req
                .input("cart_id", sql.Char(36), cart.id)
                .input("book_id", sql.Int, item.bookId)
                .input("quantity", sql.Int, item.quantity)
                .input("total", sql.Int, item.total);

            if (item.isExisting) {
                await req.query(`UPDATE dbo.cart_details
                                 SET quantity = @quantity, total = @total, updatedAt = GETDATE()
                                 WHERE cart_id = @cart_id AND book_id = @book_id`);
            } else {
                await req.query(`INSERT INTO dbo.cart_details (cart_id, book_id, quantity, total, createdAt, updatedAt)
                                 VALUES (@cart_id, @book_id, @quantity, @total, GETDATE(), GETDATE())`);
            }
        }

        const syncReq = new sql.Request(transaction);
        await syncReq
            .input("cart_id", sql.Char(36), cart.id)
            .query(`UPDATE dbo.carts
                    SET total = ISNULL((SELECT SUM(total) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        total_quantity = ISNULL((SELECT SUM(quantity) FROM dbo.cart_details WHERE cart_id = @cart_id), 0),
                        updatedAt = GETDATE()
                    WHERE id = @cart_id`);

        await transaction.commit();

        const updatedDetails = await cartModel.getCartDetails(cart.id);
        const updatedCart = await cartModel.findByUserId(userId);

        return {
            cart: updatedCart,
            items: updatedDetails,
            addedCount: itemsToAdd.length,
            warnings
        };
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return;
        }
        orderModel.handleOrderWriteError(error);
    }
}

async function dispatchGhnForPaidOrder(orderId) {
    if (!orderId) return null;
    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) return null;
    if (order.ghn_code && !order.ghn_code.startsWith("GHN_")) {
        return parseOrderJsonFields(order);
    }

    let ghnInfoObj;
    try {
        ghnInfoObj = typeof order.ghn_info === "string" ? JSON.parse(order.ghn_info) : (order.ghn_info || {});
    } catch {
        ghnInfoObj = {};
    }

    if (ghnInfoObj.deliveryType !== "GHN" || !ghnInfoObj.districtId || !ghnInfoObj.wardCode) {
        return parseOrderJsonFields(order);
    }

    const orderItems = order.items && order.items.length > 0
        ? order.items
        : await orderItemModel.findByOrderId(orderId);

    const totalQty = (orderItems || []).reduce((acc, it) => acc + (Number(it.quantity) || 1), 0);
    const weightInGrams = Math.min(20000, Math.max(300, totalQty * 350));

    try {
        const receiverName = order.recipientName || order.recipient_name || order.receiverName || ghnInfoObj.receiverName || "Khach hang";
        const phone = order.recipientPhone || order.recipient_phone || order.phone || ghnInfoObj.phone || "";
        const address = order.shippingAddress || order.shipping_address || order.address || ghnInfoObj.address || "";

        const ghnOrderRes = await ghnService.createShippingOrder({
            toName: receiverName,
            toPhone: phone,
            toAddress: address,
            toWardCode: ghnInfoObj.wardCode,
            toDistrictId: ghnInfoObj.districtId,
            weightInGrams,
            items: (orderItems || []).map((it) => ({
                title: it.title || "Sách",
                quantity: it.quantity,
                price: it.price || it.total
            })),
            codAmount: 0,
            insuranceValue: Number(order.total) || 0,
            clientOrderCode: order.id
        });

        const realGhnCode = ghnOrderRes?.order_code || null;
        if (realGhnCode) {
            ghnInfoObj.ghnCode = realGhnCode;
            const pool = await connectDB();
            const req = new sql.Request(pool);
            await req
                .input("id", sql.Char(36), order.id)
                .input("ghn_code", sql.VarChar(255), realGhnCode)
                .input("ghn_response", sql.NVarChar(sql.MAX), JSON.stringify(ghnOrderRes))
                .input("ghn_info", sql.NVarChar(sql.MAX), JSON.stringify(ghnInfoObj))
                .query(`UPDATE dbo.orders 
                        SET ghn_code = @ghn_code, 
                            ghn_response = @ghn_response, 
                            ghn_info = @ghn_info, 
                            updatedAt = GETDATE() 
                        WHERE id = @id`);
        }

        return parseOrderJsonFields({
            ...order,
            ghn_code: realGhnCode,
            ghn_response: ghnOrderRes,
            ghn_info: ghnInfoObj
        });
    } catch {
        return parseOrderJsonFields(order);
    }
}

async function syncGhnDelivered(ghnCode) {
    if (!ghnCode) return null;
    const pool = await connectDB();
    const req = new sql.Request(pool);
    const orderRes = await req
        .input("ghn_code", sql.VarChar(255), ghnCode)
        .query("SELECT TOP 1 id, status, ghn_info FROM dbo.orders WHERE ghn_code = @ghn_code");
    const order = orderRes.recordset[0];
    if (!order || Number(order.status) === 3 || Number(order.status) === 4) {
        return order || null;
    }

    let ghnInfoObj;
    try {
        ghnInfoObj = typeof order.ghn_info === "string" ? JSON.parse(order.ghn_info) : (order.ghn_info || {});
    } catch {
        ghnInfoObj = {};
    }
    ghnInfoObj.deliveredAt = new Date().toISOString();
    ghnInfoObj.deliveryNote = "Giao hàng thành công xác nhận qua GHN Tracking";

    const updateReq = new sql.Request(pool);
    await updateReq
        .input("id", sql.Char(36), order.id)
        .input("ghn_info", sql.NVarChar(sql.MAX), JSON.stringify(ghnInfoObj))
        .query("UPDATE dbo.orders SET status = 3, ghn_info = @ghn_info, updatedAt = GETDATE() WHERE id = @id AND status < 3");
    return order;
}

async function releaseExpiredVnpayOrders() {
    const pool = await connectDB();
    const req = new sql.Request(pool);
    const expiredRes = await req.query("SELECT id FROM dbo.orders WHERE payment_method = 'VNPAY' AND status = 0 AND createdAt < DATEADD(minute, -15, GETDATE())");
    const expiredOrders = expiredRes.recordset || [];
    const cancelledResults = [];
    for (const exp of expiredOrders) {
        try {
            const cancelled = await cancelOrder(exp.id, null, {
                isAdmin: true,
                reason: "Tự động hủy do quá thời gian chờ thanh toán VNPAY (15 phút)"
            });
            cancelledResults.push(cancelled);
        } catch {
            continue;
        }
    }
    return cancelledResults;
}

async function getShippingRule() {
    return await storePolicyService.getShippingPolicy();
}

module.exports = {
    createOrderFromCart,
    cancelOrder,
    updateOrderStatus,
    getUserOrders,
    getOrderDetails,
    getAllOrdersForAdmin,
    reorder,
    dispatchGhnForPaidOrder,
    syncGhnDelivered,
    releaseExpiredVnpayOrders,
    createPaymentUrlForOrder: paymentService.createPaymentUrlForOrder,
    processPaymentReturn: paymentService.processPaymentReturn,
    processPaymentIPN: paymentService.processPaymentIPN,
    generatePaymentUrl: paymentService.generatePaymentUrl,
    verifyPaymentSignature: paymentService.verifyPaymentSignature,
    getShippingRule,
    calculateItemPrice: calculateDiscountedUnitPrice,
    calculateShippingFee,
    calculateDiscountValue: discountService.calculateDiscountValue,
    validatePhoneNumber,
    validateReceiverName,
    validateAddress
};
