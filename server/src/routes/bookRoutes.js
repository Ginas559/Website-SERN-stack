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
        body("title").trim().notEmpty().withMessage("Tiêu đề sách không được để trống."),
        body("author").trim().notEmpty().withMessage("Tên tác giả không được để trống."),
        body("price").isInt({ min: 1 }).withMessage("Giá bán sách phải lớn hơn 0."),
        body("quantity").optional().isInt({ min: 0 }).withMessage("Số lượng tồn kho không được nhỏ hơn 0."),
        body("discount").optional().isInt({ min: 0, max: 100 }).withMessage("Tỉ lệ giảm giá phải từ 0% đến 100%."),
        body("purchase_price").optional().isInt({ min: 0 }).withMessage("Giá nhập kho không được nhỏ hơn 0."),
        body("categoryIds").optional().isArray().withMessage("Danh sách thể loại phải là mảng ID."),
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
        body("title").optional().trim().notEmpty().withMessage("Tiêu đề sách không được để trống."),
        body("author").optional().trim().notEmpty().withMessage("Tên tác giả không được để trống."),
        body("price").optional().isInt({ min: 1 }).withMessage("Giá bán sách phải lớn hơn 0."),
        body("quantity").optional().isInt({ min: 0 }).withMessage("Số lượng tồn kho không được nhỏ hơn 0."),
        body("discount").optional().isInt({ min: 0, max: 100 }).withMessage("Tỉ lệ giảm giá phải từ 0% đến 100%."),
        body("purchase_price").optional().isInt({ min: 0 }).withMessage("Giá nhập kho không được nhỏ hơn 0."),
        body("categoryIds").optional().isArray().withMessage("Danh sách thể loại phải là mảng ID."),
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
