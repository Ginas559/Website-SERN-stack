const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/orderController");
const validate = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post(
    "/",
    [
        body("receiverName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Họ tên người nhận không được vượt quá 100 ký tự.")
            .bail(),
        body("fullName")
            .optional()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage("Họ tên người nhận không được vượt quá 100 ký tự.")
            .bail(),
        body("phone")
            .optional()
            .trim()
            .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
            .withMessage("Số điện thoại không hợp lệ.")
            .bail(),
        body("phoneNumber")
            .optional()
            .trim()
            .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
            .withMessage("Số điện thoại không hợp lệ.")
            .bail(),
        body("address")
            .notEmpty()
            .withMessage("Địa chỉ nhận hàng không được để trống.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Địa chỉ không được vượt quá 255 ký tự.")
            .bail(),
        body("paymentMethod")
            .optional()
            .isIn(["COD", "VNPAY", "BANK"])
            .withMessage("Phương thức thanh toán không hợp lệ.")
            .bail(),
        body("selectedBookIds")
            .optional()
            .isArray()
            .withMessage("selectedBookIds phải là một danh sách mảng.")
            .bail(),
    ],
    validate,
    controller.createOrder
);

module.exports = router;

