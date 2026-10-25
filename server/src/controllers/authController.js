const authService = require("../services/authService");
const { refreshCookieOptions } = require("../middleware/authMiddleware");

function sendAuthResponse(res, result) {
    res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);
    const { refreshToken, ...response } = result;
    res.json(response);
}

async function register(req, res) { res.status(201).json(await authService.register(req.body)); }
async function login(req, res) { sendAuthResponse(res, await authService.login(req.body)); }
async function refresh(req, res) { sendAuthResponse(res, await authService.refresh(req.cookies.refreshToken)); }
async function logout(req, res) {
    await authService.logout(req.cookies.refreshToken);
    res.clearCookie("refreshToken", refreshCookieOptions);
    res.status(204).send();
}
async function forgotPassword(req, res) {
    await authService.requestPasswordReset(req.body.email);
    res.json({ message: "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi." });
}
async function resetPassword(req, res) { res.json(await authService.resetPassword(req.body.token, req.body.password)); }
async function changePassword(req, res) {
    res.json(await authService.changePassword(req.user.id, req.body.currentPassword, req.body.newPassword));
}

module.exports = { register, login, refresh, logout, forgotPassword, resetPassword, changePassword };
