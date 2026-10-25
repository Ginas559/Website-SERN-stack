const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/authController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();
const passwordRule = body("password").isLength({ min: 8 }).withMessage("Mật khẩu phải có ít nhất 8 ký tự.")
    .matches(/[A-Z]/).withMessage("Mật khẩu phải có ít nhất một chữ hoa.")
    .matches(/[a-z]/).withMessage("Mật khẩu phải có ít nhất một chữ thường.")
    .matches(/[0-9]/).withMessage("Mật khẩu phải có ít nhất một chữ số.");

router.post("/register", [
    body("username").trim().isLength({ min: 3, max: 255 }).withMessage("Username không hợp lệ."),
    body("fullName").trim().isLength({ min: 2, max: 255 }).withMessage("Họ tên không hợp lệ."),
    body("email").trim().isEmail().withMessage("Email không hợp lệ."),
    body("phone").trim().matches(/^\+?[0-9\s().-]{8,20}$/).withMessage("Số điện thoại không hợp lệ."),
    body("address").trim().isLength({ min: 2, max: 255 }).withMessage("Địa chỉ không hợp lệ."),
    passwordRule,
    body("confirmPassword").custom((value, { req }) => value === req.body.password)
        .withMessage("Mật khẩu xác nhận không khớp."),
], validate, controller.register);
router.post("/login", [body("email").trim().isEmail().withMessage("Email không hợp lệ."), body("password").notEmpty().withMessage("Vui lòng nhập mật khẩu.")], validate, controller.login);
router.post("/refresh", controller.refresh);
router.post("/logout", controller.logout);
router.post("/forgot-password", [body("email").trim().isEmail().withMessage("Email không hợp lệ.")], validate, controller.forgotPassword);
router.post("/reset-password", [body("token").trim().isLength({ min: 32 }).withMessage("Mã đặt lại mật khẩu không hợp lệ."), passwordRule], validate, controller.resetPassword);

module.exports = router;
