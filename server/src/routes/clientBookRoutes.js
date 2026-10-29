const express = require("express");
const { query, param } = require("express-validator");
const controller = require("../controllers/bookController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();

router.get(
    "/",
    [
        query("page").optional().isInt({ min: 1 }).withMessage("Số trang phải là số nguyên dương lớn hơn hoặc bằng 1."),
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Số lượng mỗi trang phải từ 1 đến 100."),
        query("categoryId").optional().isInt({ min: 1 }).withMessage("ID thể loại phải là số nguyên dương."),
        query("minPrice").optional().isInt({ min: 0 }).withMessage("Giá tối thiểu phải là số nguyên không âm."),
        query("maxPrice").optional().isInt({ min: 0 }).withMessage("Giá tối đa phải là số nguyên không âm."),
        query("sort").optional().isIn(["newest", "oldest", "price_asc", "price_desc", "discount"]).withMessage("Kiểu sắp xếp không hợp lệ."),
    ],
    validate,
    controller.getAllClient
);

router.get(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID sách không hợp lệ."),
    ],
    validate,
    controller.getDetailClient
);

module.exports = router;
