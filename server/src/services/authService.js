const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const userModel = require("../models/userModel");
const AppError = require("../utils/AppError");
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require("../utils/jwt");
const { refreshTokenExpiresIn, resetTokenExpiresMinutes, enableDevResetToken } = require("../config/config");

const normalizeEmail = (email) => email.trim().toLowerCase();
const publicUser = (user) => ({ id: user.id, username: user.username, fullName: user.full_name, email: user.email, isAdmin: Boolean(user.isAdmin) });

function refreshExpiresAt() {
    return new Date(Date.now() + (refreshTokenExpiresIn.endsWith("d") ? Number.parseInt(refreshTokenExpiresIn, 10) * 86400000 : 604800000));
}

async function issueTokens(user) {
    const tokenId = uuidv4();
    await userModel.saveRefreshToken(user.id, tokenId, refreshExpiresAt());
    return { accessToken: generateAccessToken(user), refreshToken: generateRefreshToken(user, tokenId) };
}

async function register({ username, fullName, email, phone, address, password }) {
    username = username.trim();
    fullName = fullName.trim();
    email = normalizeEmail(email);
    phone = phone.trim();
    address = address.trim();
    if (await userModel.findByUsername(username)) throw new AppError("Username đã được sử dụng.", 409);
    if (await userModel.findByEmail(email)) throw new AppError("Email đã được sử dụng.", 409);
    try {
        const user = await userModel.create({
            id: uuidv4(),
            username,
            fullName,
            email,
            phone,
            address,
            passwordHash: await bcrypt.hash(password, 12),
        });
        return { message: "Đăng ký thành công.", user: publicUser(user) };
    } catch (error) {
        if (error.number === 2601 || error.number === 2627) {
            throw new AppError("Username hoặc email đã được sử dụng.", 409);
        }
        throw error;
    }
}

async function login({ email, password }) {
    const user = await userModel.findByEmail(normalizeEmail(email));
    if (!user || user.isDelete || !(await bcrypt.compare(password, user.password))) {
        throw new AppError("Email hoặc mật khẩu không chính xác.", 401);
    }
    return { user: publicUser(user), ...(await issueTokens(user)) };
}

async function refresh(refreshToken) {
    if (!refreshToken) throw new AppError("Refresh token không tồn tại.", 401);
    let payload;
    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw new AppError("Refresh token không hợp lệ hoặc đã hết hạn.", 401);
    }
    const newTokenId = uuidv4();
    const userId = await userModel.rotateRefreshToken(payload.tokenId, newTokenId, refreshExpiresAt());
    if (!userId) throw new AppError("Refresh token đã bị thu hồi.", 401);
    const user = await userModel.findById(userId);
    if (!user || user.isDelete) throw new AppError("Tài khoản không tồn tại.", 401);
    return { user: publicUser(user), accessToken: generateAccessToken(user), refreshToken: generateRefreshToken(user, newTokenId) };
}

async function logout(refreshToken) {
    if (!refreshToken) return;
    try {
        const payload = verifyRefreshToken(refreshToken);
        await userModel.revokeRefreshToken(payload.tokenId);
    } catch {
        // An expired token is already unusable; clearing the cookie completes logout.
    }
}

async function requestPasswordReset(email) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + resetTokenExpiresMinutes * 60000);
    const saved = await userModel.saveResetToken(normalizeEmail(email), userModel.hashResetToken(token), expiresAt);
    return saved && enableDevResetToken ? { resetToken: token } : {};
}

async function resetPassword(token, password) {
    const user = await userModel.resetPassword(userModel.hashResetToken(token), await bcrypt.hash(password, 12));
    if (!user) throw new AppError("Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400);
    return { user: publicUser(user), ...(await issueTokens(user)) };
}

module.exports = { register, login, refresh, logout, requestPasswordReset, resetPassword };
