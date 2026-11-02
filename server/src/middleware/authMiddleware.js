const { verifyAccessToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");

const refreshCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
};

function protect(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return next(new AppError("Vui lòng đăng nhập để tiếp tục.", 401));
    try {
        req.user = verifyAccessToken(header.slice(7));
        next();
    } catch {
        next(new AppError("Access token không hợp lệ hoặc đã hết hạn.", 401));
    }
}

function restrictTo(...roles) {
    return (req, res, next) => roles.includes("Admin") && req.user.isAdmin
        ? next()
        : next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403));
}

module.exports = { protect, restrictTo, refreshCookieOptions };
