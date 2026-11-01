const crypto = require("crypto");
const config = require("../config/config");
const orderModel = require("../models/orderModel");
const AppError = require("../utils/AppError");

function sortObject(obj) {
    const sorted = {};
    const keys = Object.keys(obj).filter((key) => obj[key] !== undefined && obj[key] !== null && obj[key] !== "").sort();
    for (const key of keys) {
        sorted[encodeURIComponent(key)] = encodeURIComponent(String(obj[key])).replace(/%20/g, "+");
    }
    return sorted;
}

function buildSignData(sortedObj) {
    return Object.keys(sortedObj)
        .map((key) => `${key}=${sortedObj[key]}`)
        .join("&");
}

function formatVnpayDate(date = new Date()) {
    const d = new Date(date);
    const vnTime = new Date(d.getTime() + (7 * 60 + d.getTimezoneOffset()) * 60000);
    const pad = (n) => String(n).padStart(2, "0");
    const year = vnTime.getFullYear();
    const month = pad(vnTime.getMonth() + 1);
    const day = pad(vnTime.getDate());
    const hours = pad(vnTime.getHours());
    const minutes = pad(vnTime.getMinutes());
    const seconds = pad(vnTime.getSeconds());
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

const vnpayResponseMessages = {
    "00": "Giao dịch thành công.",
    "07": "Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).",
    "09": "Giao dịch không thành công do thẻ/tài khoản chưa đăng ký dịch vụ InternetBanking.",
    "10": "Giao dịch không thành công do xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.",
    "11": "Giao dịch không thành công do đã hết hạn chờ thanh toán.",
    "12": "Giao dịch không thành công do thẻ/tài khoản của khách hàng bị khóa.",
    "13": "Giao dịch không thành công do nhập sai mật khẩu xác thực giao dịch (OTP).",
    "24": "Giao dịch không thành công do khách hàng hủy giao dịch.",
    "51": "Giao dịch không thành công do tài khoản không đủ số dư.",
    "65": "Giao dịch không thành công do vượt quá hạn mức giao dịch trong ngày.",
    "75": "Ngân hàng thanh toán đang bảo trì.",
    "79": "Giao dịch không thành công do nhập sai mật khẩu thanh toán quá số lần quy định.",
    "99": "Các lỗi khác phát sinh từ cổng VNPAY."
};

function getVnpayResponseText(code) {
    return vnpayResponseMessages[code] || "Giao dịch thanh toán không thành công.";
}

function generatePaymentUrl(order, { ipAddr = "127.0.0.1", returnUrl = null } = {}) {
    const tmnCode = config.vnpay.tmnCode;
    const secretKey = config.vnpay.hashSecret;
    if (!tmnCode || !secretKey) {
        throw new AppError("Cấu hình cổng thanh toán VNPAY chưa đầy đủ.", 500);
    }
    const vnpUrl = config.vnpay.url;
    const actualReturnUrl = returnUrl || config.vnpay.returnUrl;

    const cleanIp = ipAddr && typeof ipAddr === "string" ? ipAddr.split(",")[0].trim() : "127.0.0.1";
    const amount = Math.round(Number(order.total) * 100);
    const createDate = formatVnpayDate();

    const rawParams = {
        vnp_Version: "2.1.0",
        vnp_Command: "pay",
        vnp_TmnCode: tmnCode,
        vnp_Locale: "vn",
        vnp_CurrCode: "VND",
        vnp_TxnRef: order.id,
        vnp_OrderInfo: `Thanh toan don hang ${order.id}`,
        vnp_OrderType: "billpayment",
        vnp_Amount: amount,
        vnp_ReturnUrl: actualReturnUrl,
        vnp_IpAddr: cleanIp,
        vnp_CreateDate: createDate,
    };

    const sortedParams = sortObject(rawParams);
    const signData = buildSignData(sortedParams);
    const hmac = crypto.createHmac("sha512", secretKey);
    const signed = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    sortedParams["vnp_SecureHash"] = signed;
    const queryString = buildSignData(sortedParams);
    return `${vnpUrl}?${queryString}`;
}

function verifyPaymentSignature(queryParams = {}) {
    const secureHash = queryParams.vnp_SecureHash;
    if (!secureHash || !config.vnpay.hashSecret) return false;

    const paramsToSign = {};
    for (const key of Object.keys(queryParams)) {
        if (key !== "vnp_SecureHash" && key !== "vnp_SecureHashType" && queryParams[key] !== undefined && queryParams[key] !== null && queryParams[key] !== "") {
            paramsToSign[key] = queryParams[key];
        }
    }

    const sortedParams = sortObject(paramsToSign);
    const signData = buildSignData(sortedParams);
    const hmac = crypto.createHmac("sha512", config.vnpay.hashSecret);
    const calculatedHash = hmac.update(Buffer.from(signData, "utf-8")).digest("hex");

    return calculatedHash.toLowerCase() === String(secureHash).toLowerCase();
}

async function createPaymentUrlForOrder(orderId, userId, { ipAddr = "127.0.0.1", returnUrl = null, isAdmin = false } = {}) {
    if (!orderId) {
        throw new AppError("Mã đơn hàng không hợp lệ.", 400);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng.", 404);
    }

    if (!isAdmin && order.user_id !== userId) {
        throw new AppError("Bạn không có quyền thanh toán đơn hàng này.", 403);
    }

    if (Number(order.status) === 1) {
        throw new AppError("Đơn hàng này đã được xác nhận thanh toán.", 400);
    }

    if (Number(order.status) === 4) {
        throw new AppError("Đơn hàng đã bị hủy, không thể tạo URL thanh toán.", 400);
    }

    if (Number(order.status) !== 0) {
        throw new AppError("Đơn hàng không ở trạng thái chờ thanh toán.", 400);
    }

    const paymentUrl = generatePaymentUrl(order, { ipAddr, returnUrl });
    await orderModel.updatePaymentUrl(order.id, paymentUrl);

    return {
        orderId: order.id,
        paymentUrl,
        total: order.total,
        paymentMethod: order.payment_method
    };
}

async function processPaymentReturn(queryParams = {}) {
    const isValidSignature = verifyPaymentSignature(queryParams);
    if (!isValidSignature) {
        throw new AppError("Chữ ký giao dịch VNPAY không hợp lệ hoặc dữ liệu bị can thiệp.", 400);
    }

    const orderId = queryParams.vnp_TxnRef;
    if (!orderId) {
        throw new AppError("Mã đơn hàng tham chiếu không tồn tại trong kết quả thanh toán.", 400);
    }

    const order = await orderModel.findById(orderId, { includeItems: true });
    if (!order) {
        throw new AppError("Không tìm thấy đơn hàng tương ứng với mã giao dịch.", 404);
    }

    const expectedAmount = Math.round(Number(order.total) * 100);
    const receivedAmount = Number(queryParams.vnp_Amount);
    if (expectedAmount !== receivedAmount) {
        throw new AppError("Số tiền thanh toán không khớp với giá trị đơn hàng.", 400);
    }

    const responseCode = queryParams.vnp_ResponseCode;
    const isSuccess = responseCode === "00" && queryParams.vnp_TransactionStatus === "00";
    const message = getVnpayResponseText(responseCode);

    if (isSuccess) {
        const updatedOrder = await orderModel.updatePaymentSuccess(order.id, {
            ghnResponse: queryParams,
            ghnInfo: {
                paymentGateway: "VNPAY",
                transactionNo: queryParams.vnp_TransactionNo,
                bankCode: queryParams.vnp_BankCode,
                cardType: queryParams.vnp_CardType,
                payDate: queryParams.vnp_PayDate,
                paidAt: new Date().toISOString()
            }
        });

        return {
            isSuccess: true,
            responseCode,
            message,
            order: updatedOrder
        };
    }

    await orderModel.recordPaymentFailure(order.id, {
        ghnResponse: queryParams
    });

    return {
        isSuccess: false,
        responseCode,
        message,
        order
    };
}

async function processPaymentIPN(queryParams = {}) {
    const isValidSignature = verifyPaymentSignature(queryParams);
    if (!isValidSignature) {
        return { RspCode: "97", Message: "Invalid Checksum" };
    }

    const orderId = queryParams.vnp_TxnRef;
    if (!orderId) {
        return { RspCode: "01", Message: "Order Not Found" };
    }

    const order = await orderModel.findById(orderId, { includeItems: false });
    if (!order) {
        return { RspCode: "01", Message: "Order Not Found" };
    }

    const expectedAmount = Math.round(Number(order.total) * 100);
    const receivedAmount = Number(queryParams.vnp_Amount);
    if (expectedAmount !== receivedAmount) {
        return { RspCode: "04", Message: "Invalid Amount" };
    }

    if (Number(order.status) === 1) {
        return { RspCode: "02", Message: "Order already confirmed" };
    }

    const responseCode = queryParams.vnp_ResponseCode;
    const isSuccess = responseCode === "00" && queryParams.vnp_TransactionStatus === "00";

    if (isSuccess) {
        await orderModel.updatePaymentSuccess(order.id, {
            ghnResponse: queryParams,
            ghnInfo: {
                paymentGateway: "VNPAY",
                transactionNo: queryParams.vnp_TransactionNo,
                bankCode: queryParams.vnp_BankCode,
                cardType: queryParams.vnp_CardType,
                payDate: queryParams.vnp_PayDate,
                paidAt: new Date().toISOString()
            }
        });
        return { RspCode: "00", Message: "Confirm Success" };
    }

    await orderModel.recordPaymentFailure(order.id, {
        ghnResponse: queryParams
    });
    return { RspCode: "00", Message: "Confirm Success" };
}

module.exports = {
    sortObject,
    buildSignData,
    formatVnpayDate,
    getVnpayResponseText,
    generatePaymentUrl,
    verifyPaymentSignature,
    createPaymentUrlForOrder,
    processPaymentReturn,
    processPaymentIPN
};

