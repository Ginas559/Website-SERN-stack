const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/bookController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

router.post(
    "/",
    [
        body("title").isString().trim().notEmpty().withMessage("Tiêu đề sách không được để trống.").isLength({ max: 255 }).withMessage("Tiêu đề sách không được vượt quá 255 ký tự."),
        body("author").isString().trim().notEmpty().withMessage("Tên tác giả không được để trống.").isLength({ max: 255 }).withMessage("Tên tác giả không được vượt quá 255 ký tự."),
        body("price").isInt({ min: 1 }).withMessage("Giá bán sách phải lớn hơn 0."),
        body("quantity").optional().isInt({ min: 0 }).withMessage("Số lượng tồn kho không được nhỏ hơn 0."),
        body("discount").optional().isInt({ min: 0, max: 100 }).withMessage("Tỉ lệ giảm giá phải từ 0% đến 100%."),
        body("purchase_price").optional().isInt({ min: 0 }).withMessage("Giá nhập kho không được nhỏ hơn 0."),
        body("description").optional({ values: "null" }).isString().isLength({ max: 4000 }).withMessage("Mô tả sách không hợp lệ."),
        body("image").optional({ values: "null" }).isString().isLength({ max: 255 }).withMessage("Ảnh sách không hợp lệ."),
        body("publication_date").optional({ values: "null" }).isISO8601({ strict: true, strictSeparator: true }).withMessage("Ngày xuất bản không hợp lệ."),
        body("categoryIds").optional().isArray().withMessage("Danh sách thể loại phải là mảng ID."),
        body("categoryIds.*").isInt({ min: 1 }).withMessage("Mỗi ID thể loại phải là số nguyên dương."),
    ],
    validate,
    controller.create
);

router.get(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID sách không hợp lệ."),
    ],
    validate,
    controller.getById
);

router.put(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID sách không hợp lệ."),
        body("title").optional().isString().trim().notEmpty().withMessage("Tiêu đề sách không được để trống.").isLength({ max: 255 }).withMessage("Tiêu đề sách không được vượt quá 255 ký tự."),
        body("author").optional().isString().trim().notEmpty().withMessage("Tên tác giả không được để trống.").isLength({ max: 255 }).withMessage("Tên tác giả không được vượt quá 255 ký tự."),
        body("price").optional().isInt({ min: 1 }).withMessage("Giá bán sách phải lớn hơn 0."),
        body("quantity").optional().isInt({ min: 0 }).withMessage("Số lượng tồn kho không được nhỏ hơn 0."),
        body("discount").optional().isInt({ min: 0, max: 100 }).withMessage("Tỉ lệ giảm giá phải từ 0% đến 100%."),
        body("purchase_price").optional().isInt({ min: 0 }).withMessage("Giá nhập kho không được nhỏ hơn 0."),
        body("description").optional({ values: "null" }).isString().isLength({ max: 4000 }).withMessage("Mô tả sách không hợp lệ."),
        body("image").optional({ values: "null" }).isString().isLength({ max: 255 }).withMessage("Ảnh sách không hợp lệ."),
        body("publication_date").optional({ values: "null" }).isISO8601({ strict: true, strictSeparator: true }).withMessage("Ngày xuất bản không hợp lệ."),
        body("categoryIds").optional().isArray().withMessage("Danh sách thể loại phải là mảng ID."),
        body("categoryIds.*").isInt({ min: 1 }).withMessage("Mỗi ID thể loại phải là số nguyên dương."),
    ],
    validate,
    controller.update
);

router.patch(
    "/:id/status",
    [
        param("id").isInt({ min: 1 }).withMessage("ID sách không hợp lệ."),
        body("isDelete").isIn([0, 1]).withMessage("Trạng thái isDelete phải là 0 hoặc 1."),
    ],
    validate,
    controller.changeStatus
);

module.exports = router;
