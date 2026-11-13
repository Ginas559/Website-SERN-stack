const express = require("express");
const { query, param } = require("express-validator");
const controller = require("../controllers/bookController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();
const MAX_INT32 = 2147483647;

router.get(
    "/",
    [
        query("page").optional().isInt({ min: 1, max: MAX_INT32 }).withMessage("Số trang phải là số nguyên dương lớn hơn hoặc bằng 1."),
        query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Số lượng mỗi trang phải từ 1 đến 100."),
        query("categoryId").optional().isInt({ min: 1, max: MAX_INT32 }).withMessage("ID thể loại phải là số nguyên dương."),
        query("minPrice").optional().isInt({ min: 0, max: MAX_INT32 }).withMessage("Giá tối thiểu phải là số nguyên không âm."),
        query("maxPrice").optional().isInt({ min: 0, max: MAX_INT32 }).withMessage("Giá tối đa phải là số nguyên không âm."),
        query("sort").optional().isIn(["newest", "oldest", "price_asc", "price_desc", "discount"]).withMessage("Kiểu sắp xếp không hợp lệ."),
    ],
    validate,
    controller.getAllClient
);

router.get(
    "/:id",
    [
        param("id").isInt({ min: 1, max: MAX_INT32 }).withMessage("ID sách không hợp lệ."),
    ],
    validate,
    controller.getDetailClient
);

module.exports = router;
