const nodemailer = require("nodemailer");
const { clientUrl, smtp } = require("../config/config");
const AppError = require("../utils/AppError");

function createTransporter() {
    if (!smtp.host || !smtp.user || !smtp.password || !smtp.from) {
        throw new AppError("Dịch vụ email chưa được cấu hình.", 503);
    }

    return nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.password },
    });
}

async function sendPasswordResetEmail(email, token) {
    const resetUrl = `${clientUrl}/#resetToken=${encodeURIComponent(token)}`;
    try {
        await createTransporter().sendMail({
            from: smtp.from,
            to: email,
            subject: "Đặt lại mật khẩu SERN Bookstore",
            text: `Mở liên kết sau để đặt lại mật khẩu (liên kết có hiệu lực trong thời gian giới hạn): ${resetUrl}`,
            html: `<p>Bạn đã yêu cầu đặt lại mật khẩu.</p><p><a href="${resetUrl}">Đặt lại mật khẩu</a></p><p>Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>`,
        });
    } catch {
        throw new AppError("Không thể gửi email đặt lại mật khẩu.", 503);
    }
}

module.exports = { sendPasswordResetEmail };
