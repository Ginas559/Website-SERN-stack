const express = require("express");
const { param, query } = require("express-validator");
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

