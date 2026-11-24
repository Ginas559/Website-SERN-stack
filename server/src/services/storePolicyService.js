const storePolicyModel = require("../models/storePolicyModel");
const AppError = require("../utils/AppError");
const { SHIPPING_RULE } = require("../utils/pricing");

const POLICY_KEYS = Object.freeze({
    STANDARD_FEE: "shipping_standard_fee",
    FREE_THRESHOLD: "free_shipping_threshold"
});

const MAX_STANDARD_FEE = 10000000;
const MAX_FREE_THRESHOLD = 1000000000;
const CACHE_TTL_MS = 30000;

let cachedShippingPolicy = null;
let cacheLoadedAt = 0;

function parsePolicyNonNegativeInt(rawValue, fallbackValue) {
    if (rawValue === undefined || rawValue === null || rawValue === "") {
        return fallbackValue;
    }
    const parsed = Number(rawValue);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return fallbackValue;
    }
    return parsed;
}

function buildShippingPolicyObject(rows = []) {
    const byKey = new Map(rows.map((row) => [row.policy_key, row]));
    const feeRow = byKey.get(POLICY_KEYS.STANDARD_FEE);
    const thresholdRow = byKey.get(POLICY_KEYS.FREE_THRESHOLD);

    const standardFee = parsePolicyNonNegativeInt(feeRow?.policy_value, SHIPPING_RULE.standardFee);
    const freeThreshold = parsePolicyNonNegativeInt(thresholdRow?.policy_value, SHIPPING_RULE.freeThreshold);

    let latestUpdatedAt = null;
    for (const row of [feeRow, thresholdRow]) {
        if (row?.updatedAt) {
            if (!latestUpdatedAt || new Date(row.updatedAt) > new Date(latestUpdatedAt)) {
                latestUpdatedAt = row.updatedAt;
            }
        }
    }

    return {
        freeThreshold,
        standardFee,
        updatedAt: latestUpdatedAt
    };
}

function invalidateShippingPolicyCache() {
    cachedShippingPolicy = null;
    cacheLoadedAt = 0;
}

async function getShippingPolicy({ bypassCache = false } = {}) {
    const now = Date.now();
    if (!bypassCache && cachedShippingPolicy && now - cacheLoadedAt < CACHE_TTL_MS) {
        return cachedShippingPolicy;
    }

    try {
        const rows = await storePolicyModel.findByKeys([
            POLICY_KEYS.STANDARD_FEE,
            POLICY_KEYS.FREE_THRESHOLD
        ]);
        cachedShippingPolicy = buildShippingPolicyObject(rows);
        cacheLoadedAt = now;
        return cachedShippingPolicy;
    } catch {
        return {
            freeThreshold: SHIPPING_RULE.freeThreshold,
            standardFee: SHIPPING_RULE.standardFee,
            updatedAt: null
        };
    }
}

function validatePolicyInteger(value, label, maxLimit) {
    if (value === undefined || value === null || value === "") {
        throw new AppError(`${label} không được để trống.`, 400);
    }
    const num = Number(value);
    if (!Number.isFinite(num) || !Number.isInteger(num)) {
        throw new AppError(`${label} phải là số nguyên hợp lệ.`, 400);
    }
    if (num < 0) {
        throw new AppError(`${label} không được nhỏ hơn 0.`, 400);
    }
    if (num > maxLimit) {
        const formattedMax = maxLimit.toLocaleString("vi-VN");
        throw new AppError(`${label} không được vượt quá ${formattedMax}đ.`, 400);
    }
    return num;
}

async function updateShippingPolicy({ standardFee, freeThreshold, expectedUpdatedAt = null } = {}, adminUserId = null) {
    const validStandardFee = validatePolicyInteger(standardFee, "Phí giao hàng tiêu chuẩn", MAX_STANDARD_FEE);
    const validFreeThreshold = validatePolicyInteger(freeThreshold, "Ngưỡng miễn phí vận chuyển", MAX_FREE_THRESHOLD);

    const updatedRows = await storePolicyModel.upsertPolicies(
        [
            {
                policyKey: POLICY_KEYS.STANDARD_FEE,
                policyValue: String(validStandardFee),
                valueType: "INT",
                description: "Phí giao hàng tiêu chuẩn mặc định toàn shop (VNĐ)"
            },
            {
                policyKey: POLICY_KEYS.FREE_THRESHOLD,
                policyValue: String(validFreeThreshold),
                valueType: "INT",
                description: "Ngưỡng giá trị đơn hàng tối thiểu để miễn phí vận chuyển toàn shop (VNĐ)"
            }
        ],
        adminUserId,
        expectedUpdatedAt
    );

    cachedShippingPolicy = buildShippingPolicyObject(updatedRows);
    cacheLoadedAt = Date.now();
    return cachedShippingPolicy;
}

async function getAllPolicies() {
    return await storePolicyModel.findAll();
}

module.exports = {
    POLICY_KEYS,
    getShippingPolicy,
    updateShippingPolicy,
    getAllPolicies,
    invalidateShippingPolicyCache
};

