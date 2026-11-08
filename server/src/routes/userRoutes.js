const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/userController");
const validate = require("../middleware/validateMiddleware");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.get("/profile", controller.getProfile);
router.get("/status", controller.getAccountStatus);

router.put(
    "/profile",
    [
        body("fullName")
            .optional({ nullable: true })
            .isString()
            .withMessage("Họ và tên phải là chuỗi ký tự.")
            .bail()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Họ và tên không được vượt quá 100 ký tự.")
            .bail(),
        body("phoneNumber")
            .optional({ nullable: true })
            .isString()
            .withMessage("Số điện thoại phải là chuỗi ký tự.")
            .bail()
            .trim()
            .matches(/(84|0[3|5|7|8|9])+([0-9]{8})\b/)
            .withMessage("Định dạng số điện thoại không hợp lệ.")
            .bail()
            .isLength({ max: 20 })
            .withMessage("Số điện thoại không được vượt quá 20 ký tự.")
            .bail(),
        body("address")
            .optional({ nullable: true })
            .isString()
            .withMessage("Địa chỉ phải là chuỗi ký tự.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Địa chỉ không được vượt quá 255 ký tự.")
            .bail(),
        body("avatar")
            .optional({ nullable: true })
            .isString()
            .withMessage("Ảnh đại diện phải là chuỗi đường dẫn URL.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Đường dẫn ảnh đại diện không được vượt quá 255 ký tự.")
            .bail()
    ],
    validate,
    controller.updateProfile
);

module.exports = router;

