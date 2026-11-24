const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/discountController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

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
            .trim(),
        query("status")
            .optional()
            .isIn(["all", "active", "expired", "exhausted"])
            .withMessage("Trạng thái lọc không hợp lệ.")
            .bail(),
        query("isDelete")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Cờ trạng thái xóa phải là 0 hoặc 1.")
            .bail()
            .toInt()
    ],
    validate,
    controller.adminGetAll
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
    controller.adminGetById
);

router.post(
    "/",
    [
        body("code")
            .isString()
            .withMessage("Mã khuyến mãi phải là chuỗi.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Mã khuyến mãi không được để trống.")
            .isLength({ max: 50 })
            .withMessage("Mã khuyến mãi không được vượt quá 50 ký tự."),
        body("discount_type")
            .isIn(["PERCENT", "FIXED"])
            .withMessage("Loại khuyến mãi phải là PERCENT hoặc FIXED.")
            .bail(),
        body("value")
            .isNumeric()
            .withMessage("Giá trị khuyến mãi phải là số.")
            .bail()
            .custom((val, { req }) => {
                const num = Number(val);
                if (num <= 0) throw new Error("Giá trị khuyến mãi phải lớn hơn 0.");
                if (req.body.discount_type === "PERCENT" && num > 100) {
                    throw new Error("Phần trăm giảm giá không được vượt quá 100%.");
                }
                return true;
            }),
        body("maxDiscountValue")
            .optional({ values: "null" })
            .isNumeric()
            .withMessage("Giá trị giảm tối đa phải là số.")
            .bail()
            .custom((val) => Number(val) >= 0)
            .withMessage("Giá trị giảm tối đa không được âm."),
        body("minimumOrderValue")
            .optional({ values: "null" })
            .isNumeric()
            .withMessage("Đơn hàng tối thiểu phải là số.")
            .bail()
            .custom((val) => Number(val) >= 0)
            .withMessage("Đơn hàng tối thiểu không được âm."),
        body("quantity")
            .optional({ values: "null" })
            .isInt({ min: 1 })
            .withMessage("Số lượng phát hành phải là số nguyên lớn hơn 0."),
        body("description")
            .optional({ values: "null" })
            .isString()
            .withMessage("Mô tả phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Mô tả không được vượt quá 255 ký tự."),
        body("startDate")
            .optional({ values: "null" })
            .isISO8601()
            .withMessage("Ngày bắt đầu không đúng định dạng ngày tháng."),
        body("expiredAt")
            .optional({ values: "null" })
            .isISO8601()
            .withMessage("Ngày kết thúc không đúng định dạng ngày tháng.")
    ],
    validate,
    controller.adminCreate
);

router.put(
    "/:id",
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID khuyến mãi không hợp lệ.")
            .bail()
            .toInt(),
        body("code")
            .optional()
            .isString()
            .withMessage("Mã khuyến mãi phải là chuỗi.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Mã khuyến mãi không được để trống.")
            .isLength({ max: 50 })
            .withMessage("Mã khuyến mãi không được vượt quá 50 ký tự."),
        body("discount_type")
            .optional()
            .isIn(["PERCENT", "FIXED"])
            .withMessage("Loại khuyến mãi phải là PERCENT hoặc FIXED.")
            .bail(),
        body("value")
            .optional()
            .isNumeric()
            .withMessage("Giá trị khuyến mãi phải là số.")
            .bail()
            .custom((val) => Number(val) > 0)
            .withMessage("Giá trị khuyến mãi phải lớn hơn 0."),
        body("maxDiscountValue")
            .optional({ values: "null" })
            .isNumeric()
            .withMessage("Giá trị giảm tối đa phải là số.")
            .bail()
            .custom((val) => Number(val) >= 0)
            .withMessage("Giá trị giảm tối đa không được âm."),
        body("minimumOrderValue")
            .optional({ values: "null" })
            .isNumeric()
            .withMessage("Đơn hàng tối thiểu phải là số.")
            .bail()
            .custom((val) => Number(val) >= 0)
            .withMessage("Đơn hàng tối thiểu không được âm."),
        body("quantity")
            .optional({ values: "null" })
            .isInt({ min: 1 })
            .withMessage("Số lượng phát hành phải là số nguyên lớn hơn 0."),
        body("description")
            .optional({ values: "null" })
            .isString()
            .withMessage("Mô tả phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Mô tả không được vượt quá 255 ký tự."),
        body("startDate")
            .optional({ values: "null" })
            .isISO8601()
            .withMessage("Ngày bắt đầu không đúng định dạng ngày tháng."),
        body("expiredAt")
            .optional({ values: "null" })
            .isISO8601()
            .withMessage("Ngày kết thúc không đúng định dạng ngày tháng.")
    ],
    validate,
    controller.adminUpdate
);

router.patch(
    "/:id/status",
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID khuyến mãi không hợp lệ.")
            .bail()
            .toInt(),
        body("isDelete")
            .isBoolean()
            .withMessage("Cờ trạng thái xóa phải là giá trị boolean (true/false).")
    ],
    validate,
    controller.adminChangeStatus
);

module.exports = router;

