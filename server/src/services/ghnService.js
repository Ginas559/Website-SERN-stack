const AppError = require("../utils/AppError");
const storePolicyService = require("./storePolicyService");

const GHN_CONFIG = Object.freeze({
    get token() {
        return process.env.GHN_TOKEN || "";
    },
    get shopId() {
        return process.env.GHN_SHOP_ID ? String(process.env.GHN_SHOP_ID) : "";
    },
    get baseUrl() {
        return process.env.GHN_BASE_URL || "https://online-gateway.ghn.vn/shiip/public-api";
    },
    get defaultOriginDistrictId() {
        return process.env.GHN_ORIGIN_DISTRICT_ID ? Number(process.env.GHN_ORIGIN_DISTRICT_ID) : 3695;
    }
});

const cache = {
    provinces: null,
    provincesLoadedAt: 0,
    districtsByProvince: new Map(),
    wardsByDistrict: new Map()
};

const inFlightOrders = new Set();

const CACHE_TTL_MS = 3600000;

function getGhnHeaders() {
    if (!GHN_CONFIG.token) {
        throw new AppError("Cấu hình GHN_TOKEN chưa được thiết lập trong hệ thống.", 500);
    }
    const headers = {
        "Token": GHN_CONFIG.token,
        "Content-Type": "application/json"
    };
    if (GHN_CONFIG.shopId) {
        headers["ShopId"] = GHN_CONFIG.shopId;
    }
    return headers;
}

async function fetchGhnApi(endpoint, options = {}) {
    const url = `${GHN_CONFIG.baseUrl}${endpoint}`;
    const headers = {
        ...getGhnHeaders(),
        ...(options.headers || {})
    };

    let response;
    try {
        const timeoutSignal = AbortSignal.timeout(8000);
        const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal;
        response = await fetch(url, {
            ...options,
            headers,
            signal
        });
    } catch (err) {
        if (err.name === "TimeoutError" || err.name === "AbortError") {
            throw new AppError("Kết nối tới cổng vận chuyển GHN bị quá thời gian chờ (Timeout 8s).", 504);
        }
        throw new AppError(`Không thể kết nối máy chủ vận chuyển GHN: ${err.message}`, 502);
    }

    let data;
    try {
        data = await response.json();
    } catch {
        throw new AppError("Dữ liệu phản hồi từ GHN không hợp lệ.", 502);
    }

    if (!response.ok || (data.code && data.code !== 200)) {
        const errorMsg = data.message || `Lỗi cổng vận chuyển GHN (Mã: ${data.code || response.status})`;
        throw new AppError(errorMsg, response.status >= 400 && response.status < 500 ? 400 : 502);
    }

    return data.data;
}

async function getProvinces() {
    const now = Date.now();
    if (cache.provinces && now - cache.provincesLoadedAt < CACHE_TTL_MS) {
        return cache.provinces;
    }

    const rawList = await fetchGhnApi("/master-data/province", { method: "GET" });
    const formatted = (Array.isArray(rawList) ? rawList : [])
        .map((p) => ({
            provinceId: p.ProvinceID,
            provinceName: p.ProvinceName,
            countryId: p.CountryID,
            code: p.Code
        }))
        .sort((a, b) => a.provinceName.localeCompare(b.provinceName, "vi"));

    cache.provinces = formatted;
    cache.provincesLoadedAt = now;
    return formatted;
}

async function getDistricts(provinceId) {
    const pId = Number(provinceId);
    if (!pId || Number.isNaN(pId)) {
        throw new AppError("provinceId không hợp lệ.", 400);
    }

    const now = Date.now();
    const cached = cache.districtsByProvince.get(pId);
    if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    const rawList = await fetchGhnApi(`/master-data/district?province_id=${pId}`, { method: "GET" });
    const formatted = (Array.isArray(rawList) ? rawList : [])
        .map((d) => ({
            districtId: d.DistrictID,
            districtName: d.DistrictName,
            provinceId: d.ProvinceID,
            code: d.Code
        }))
        .sort((a, b) => a.districtName.localeCompare(b.districtName, "vi"));

    cache.districtsByProvince.set(pId, { data: formatted, loadedAt: now });
    return formatted;
}

async function getWards(districtId) {
    const dId = Number(districtId);
    if (!dId || Number.isNaN(dId)) {
        throw new AppError("districtId không hợp lệ.", 400);
    }

    const now = Date.now();
    const cached = cache.wardsByDistrict.get(dId);
    if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
        return cached.data;
    }

    const rawList = await fetchGhnApi(`/master-data/ward?district_id=${dId}`, { method: "GET" });
    const formatted = (Array.isArray(rawList) ? rawList : [])
        .map((w) => ({
            wardCode: String(w.WardCode),
            wardName: w.WardName,
            districtId: w.DistrictID
        }))
        .sort((a, b) => a.wardName.localeCompare(b.wardName, "vi"));

    cache.wardsByDistrict.set(dId, { data: formatted, loadedAt: now });
    return formatted;
}

function isInnerCityHcm(provinceName = "", provinceId = null) {
    if (provinceId === 202) {
        return true;
    }
    const normalized = String(provinceName || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d");

    if (
        normalized.includes("ho chi minh") ||
        normalized.includes("hcm") ||
        normalized.includes("sai gon") ||
        normalized.includes("thu duc")
    ) {
        return true;
    }

    const hcmKeywords = [
        "quan 1", "quan 2", "quan 3", "quan 4", "quan 5", "quan 6",
        "quan 7", "quan 8", "quan 9", "quan 10", "quan 11", "quan 12",
        "q.1", "q.2", "q.3", "q.4", "q.5", "q.6", "q.7", "q.8", "q.9", "q.10", "q.11", "q.12",
        "q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8", "q9", "q10", "q11", "q12",
        "binh thanh", "phu nhuan", "go vap", "tan binh", "tan phu",
        "binh tan", "nha be", "hoc mon", "cu chi", "binh chanh", "can gio"
    ];

    return hcmKeywords.some((k) => {
        const escaped = k.replace(".", "\\.");
        const regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i");
        return regex.test(normalized);
    });
}

async function calculateShippingFee({
    toDistrictId,
    toWardCode,
    weightInGrams = 500,
    lengthCm = 20,
    widthCm = 15,
    heightCm = 10,
    insuranceValue = 0,
    orderTotal = 0,
    provinceName = "",
    provinceId = null
}) {
    const storePolicy = await storePolicyService.getShippingPolicy();
    const isInnerCity = isInnerCityHcm(provinceName, provinceId);

    if (isInnerCity) {
        const isFree = orderTotal >= storePolicy.freeThreshold;
        const fee = isFree ? 0 : storePolicy.standardFee;
        return {
            deliveryType: "INTERNAL",
            deliveryProvider: "Shop Shipper (Nội thành TP.HCM)",
            estimatedDelivery: "Giao nhanh trong 24 giờ",
            standardFee: storePolicy.standardFee,
            freeThreshold: storePolicy.freeThreshold,
            isFreeShipping: isFree,
            shippingFee: fee,
            rawFeeData: null
        };
    }

    if (!toDistrictId) {
        throw new AppError("Vui lòng cung cấp toDistrictId để tính phí vận chuyển liên tỉnh.", 400);
    }

    const payload = {
        from_district_id: GHN_CONFIG.defaultOriginDistrictId,
        service_type_id: 2,
        to_district_id: Number(toDistrictId),
        to_ward_code: toWardCode ? String(toWardCode) : "",
        height: Math.min(150, Math.max(5, Math.round(Number(heightCm) || 10))),
        length: Math.min(150, Math.max(10, Math.round(Number(lengthCm) || 20))),
        width: Math.min(150, Math.max(10, Math.round(Number(widthCm) || 15))),
        weight: Math.min(20000, Math.max(200, Math.round(Number(weightInGrams) || 500))),
        insurance_value: Math.min(5000000, Math.max(0, Math.round(Number(insuranceValue) || Number(orderTotal) || 0)))
    };

    let ghnResult;
    try {
        ghnResult = await fetchGhnApi("/v2/shipping-order/fee", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    } catch (err) {
        const fallbackFee = storePolicy.standardFee;
        return {
            deliveryType: "GHN",
            deliveryProvider: "GHN Express (Dự phòng)",
            estimatedDelivery: "2 - 4 ngày làm việc",
            standardFee: fallbackFee,
            freeThreshold: null,
            isFreeShipping: false,
            shippingFee: fallbackFee,
            rawFeeData: null,
            warning: err.message
        };
    }

    const calculatedGhnFee = Number(ghnResult?.total || storePolicy.standardFee);

    return {
        deliveryType: "GHN",
        deliveryProvider: "GHN Express (Giao Hàng Nhanh)",
        estimatedDelivery: "2 - 4 ngày làm việc",
        standardFee: calculatedGhnFee,
        freeThreshold: null,
        isFreeShipping: false,
        shippingFee: calculatedGhnFee,
        rawFeeData: ghnResult
    };
}

async function createShippingOrder({
    toName,
    toPhone,
    toAddress,
    toWardCode,
    toDistrictId,
    weightInGrams = 500,
    items = [],
    codAmount = 0,
    insuranceValue = 0,
    clientOrderCode = ""
}) {
    if (!toName || !toPhone || !toAddress || !toDistrictId || !toWardCode) {
        throw new AppError("Thiếu thông tin người nhận hàng bắt buộc để tạo vận đơn GHN.", 400);
    }

    const cleanOrderCode = clientOrderCode ? String(clientOrderCode).trim() : "";
    if (cleanOrderCode && inFlightOrders.has(cleanOrderCode)) {
        throw new AppError("Yêu cầu tạo vận đơn cho đơn hàng này đang được xử lý, vui lòng không gửi trùng lặp.", 409);
    }

    let cleanPhone = String(toPhone).replace(/\D/g, "");
    if (cleanPhone.startsWith("84") && cleanPhone.length === 11) {
        cleanPhone = "0" + cleanPhone.slice(2);
    }
    if (!/^0\d{9}$/.test(cleanPhone)) {
        throw new AppError("Số điện thoại người nhận không hợp lệ (yêu cầu 10 chữ số bắt đầu bằng 0).", 400);
    }

    const cleanAddress = String(toAddress).replace(/[\r\n\t]+/g, " ").trim();
    if (cleanAddress.length < 5) {
        throw new AppError("Địa chỉ giao hàng quá ngắn, vui lòng nhập đầy đủ số nhà và tên đường.", 400);
    }

    if (cleanOrderCode) {
        inFlightOrders.add(cleanOrderCode);
    }

    try {
        const ghnItems = (items || []).map((it) => ({
            name: String(it.title || it.bookTitle || "Sách ấn phẩm").slice(0, 100),
            code: String(it.bookId || it.id || "").slice(0, 50),
            quantity: Math.max(1, Number(it.quantity) || 1),
            price: Math.max(0, Number(it.price) || 0),
            weight: Math.min(20000, Math.max(100, Math.round(Number(it.weight) || 300)))
        }));

        const payload = {
            payment_type_id: 1,
            note: "Cho xem hàng, không cho thử",
            required_note: "CHOXEMHANGKHONGTHU",
            from_name: process.env.GHN_FROM_NAME || "BookStore HCMUTE",
            from_phone: process.env.GHN_FROM_PHONE || "0900000000",
            from_address: process.env.GHN_FROM_ADDRESS || "Số 1 Võ Văn Ngân, Phường Linh Chiểu, Thành phố Thủ Đức, Hồ Chí Minh",
            from_district_name: process.env.GHN_FROM_DISTRICT || "Thành Phố Thủ Đức",
            from_province_name: process.env.GHN_FROM_PROVINCE || "TP. Hồ Chí Minh",
            from_ward_name: process.env.GHN_FROM_WARD || "Phường Linh Chiểu",
            client_order_code: cleanOrderCode || undefined,
            to_name: String(toName).trim().slice(0, 100),
            to_phone: cleanPhone,
            to_address: cleanAddress,
            to_ward_code: String(toWardCode).trim(),
            to_district_id: Number(toDistrictId),
            cod_amount: Math.max(0, Math.round(Number(codAmount) || 0)),
            content: "Đơn hàng sách từ BookWeb",
            weight: Math.min(20000, Math.max(200, Math.round(Number(weightInGrams) || 500))),
            length: 20,
            width: 15,
            height: 10,
            insurance_value: Math.min(5000000, Math.max(0, Math.round(Number(insuranceValue) || 0))),
            service_type_id: 2,
            items: ghnItems.length > 0 ? ghnItems : [{ name: "Sách", quantity: 1, price: 50000 }]
        };

        return await fetchGhnApi("/v2/shipping-order/create", {
            method: "POST",
            body: JSON.stringify(payload)
        });
    } finally {
        if (cleanOrderCode) {
            inFlightOrders.delete(cleanOrderCode);
        }
    }
}

async function getShippingOrderDetail(orderCode) {
    const cleanCode = String(orderCode || "").trim();
    if (!cleanCode) {
        throw new AppError("Mã vận đơn GHN không hợp lệ.", 400);
    }
    return await fetchGhnApi("/v2/shipping-order/detail", {
        method: "POST",
        body: JSON.stringify({ order_code: cleanCode })
    });
}

async function cancelShippingOrder(orderCode) {
    const cleanCode = String(orderCode || "").trim();
    if (!cleanCode) {
        throw new AppError("Mã vận đơn GHN không hợp lệ.", 400);
    }
    const result = await fetchGhnApi("/v2/switch-status/cancel", {
        method: "POST",
        body: JSON.stringify({ order_codes: [cleanCode] })
    });
    return Array.isArray(result) ? result[0] : result;
}

module.exports = {
    GHN_CONFIG,
    getProvinces,
    getDistricts,
    getWards,
    isInnerCityHcm,
    calculateShippingFee,
    createShippingOrder,
    getShippingOrderDetail,
    cancelShippingOrder
};
