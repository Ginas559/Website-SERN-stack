const { verifyAccessToken } = require("../utils/jwt");
const AppError = require("../utils/AppError");
const userModel = require("../models/userModel");

const refreshCookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/auth",
};

async function protect(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return next(new AppError("Vui lòng đăng nhập để tiếp tục.", 401));
    let tokenUser;
    try {
        tokenUser = verifyAccessToken(header.slice(7));
    } catch {
        return next(new AppError("Access token không hợp lệ hoặc đã hết hạn.", 401));
    }

    let currentUser;
    try {
        currentUser = await userModel.findStatusById(tokenUser.id);
    } catch (error) {
        return next(error);
    }
    if (!currentUser) {
        return next(new AppError("Tài khoản không tồn tại.", 401));
    }
    if (currentUser.isDelete === 1) {
        const reason = currentUser.blockReason ? ` ${currentUser.blockReason}.` : "";
        return next(new AppError(`Tài khoản của bạn đã bị khóa.${reason}`, 403));
    }
    req.user = {
        ...tokenUser,
        role: currentUser.role
    };
    return next();
}

async function optionalAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return next();
    try {
        const tokenUser = verifyAccessToken(header.slice(7));
        const currentUser = await userModel.findStatusById(tokenUser.id);
        if (!currentUser || currentUser.isDelete === 1) {
            req.user = null;
            return next();
        }
        req.user = {
            ...tokenUser,
            role: currentUser.role
        };
    } catch {
        req.user = null;
    }
    return next();
}

function restrictTo(...roles) {
    return (req, res, next) => roles.includes(req.user.role)
        ? next()
        : next(new AppError("Bạn không có quyền thực hiện thao tác này.", 403));
}

module.exports = { protect, optionalAuth, restrictTo, refreshCookieOptions };
