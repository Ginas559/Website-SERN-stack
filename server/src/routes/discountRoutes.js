const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/discountController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();

router.get(
    "/",
    [
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Trang phải là số nguyên lớn hơn 0.")
            .bail()
            .toInt(),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage("Số lượng mỗi trang phải từ 1 đến 100.")
            .bail()
            .toInt(),
        query("search")
            .optional()
            .isString()
            .withMessage("Từ khóa tìm kiếm phải là chuỗi.")
            .bail()
            .trim()
    ],
    validate,
    controller.getActiveDiscounts
);

router.post(
    "/validate",
    [
        body("code")
            .isString()
            .withMessage("Mã khuyến mãi phải là chuỗi ký tự.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Vui lòng cung cấp mã khuyến mãi.")
            .bail()
            .isLength({ max: 50 })
            .withMessage("Mã khuyến mãi không được vượt quá 50 ký tự."),
        body("subtotal")
            .notEmpty()
            .withMessage("Vui lòng cung cấp tổng tiền tạm tính của đơn hàng.")
            .bail()
            .isNumeric()
            .withMessage("Tổng tiền tạm tính phải là một số hợp lệ.")
            .bail()
            .custom((val) => Number(val) > 0)
            .withMessage("Tổng tiền tạm tính phải lớn hơn 0.")
            .bail()
            .toInt(),
        body("shippingFee")
            .optional()
            .isNumeric()
            .withMessage("Phí vận chuyển phải là một số hợp lệ.")
            .bail()
            .custom((val) => Number(val) >= 0)
            .withMessage("Phí vận chuyển không được là số âm.")
            .bail()
            .toInt()
    ],
    validate,
    controller.validateAndCalculate
);

router.get(
    "/code/:code",
    [
        param("code")
            .isString()
            .withMessage("Mã khuyến mãi phải là chuỗi.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Mã khuyến mãi không được để trống.")
    ],
    validate,
    controller.getByCode
);

router.get(
    "/:id",
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID khuyến mãi không hợp lệ.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getById
);

module.exports = router;
