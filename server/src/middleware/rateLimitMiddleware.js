const AppError = require("../utils/AppError");

const stores = new Map();
const MAX_RATE_LIMIT_ENTRIES = 10000;

function readPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createRateLimiter({ name, maxRequests, windowMs, keyGenerator = (req) => req.ip } = {}) {
    const safeMaxRequests = readPositiveInteger(maxRequests, 10);
    const safeWindowMs = readPositiveInteger(windowMs, 15 * 60 * 1000);

    return (req, res, next) => {
        const key = `${name}:${keyGenerator(req) || "unknown"}`;
        const now = Date.now();
        if (stores.size >= MAX_RATE_LIMIT_ENTRIES) {
            for (const [storedKey, storedEntry] of stores) {
                if (storedEntry.expiresAt <= now || stores.size >= MAX_RATE_LIMIT_ENTRIES) {
                    stores.delete(storedKey);
                }
                if (stores.size < MAX_RATE_LIMIT_ENTRIES * 0.9) break;
            }
        }
        const current = stores.get(key);
        if (current && current.expiresAt <= now) {
            stores.delete(key);
        }
        const entry = current && current.expiresAt > now
            ? current
            : { count: 0, expiresAt: now + safeWindowMs };

        entry.count += 1;
        stores.set(key, entry);

        if (entry.count > safeMaxRequests) {
            const retryAfterSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
            res.set("Retry-After", String(retryAfterSeconds));
            return next(new AppError("Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.", 429));
        }

        return next();
    };
}

const loginRateLimiter = createRateLimiter({
    name: "login",
    maxRequests: process.env.AUTH_LOGIN_RATE_LIMIT_MAX || 10,
    windowMs: process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
});

const refreshRateLimiter = createRateLimiter({
    name: "refresh",
    maxRequests: process.env.AUTH_REFRESH_RATE_LIMIT_MAX || 20,
    windowMs: process.env.AUTH_REFRESH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
});

module.exports = { createRateLimiter, loginRateLimiter, refreshRateLimiter };
