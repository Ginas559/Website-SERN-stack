const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/reviewController");
const validate = require("../middleware/validateMiddleware");
const authenticate = require("../middleware/authMiddleware");
const authorizeAdmin = require("../middleware/adminMiddleware");

const router = express.Router();

router.get(
    "/books/:bookId/reviews",
    [
        param("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        query("page")
            .optional()
            .isInt({ min: 1 })
            .withMessage("Trang phải là số nguyên lớn hơn 0.")
            .bail()
            .toInt(),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Số lượng mỗi trang phải từ 1 đến 50.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getBookReviews
);

router.post(
    "/books/:bookId/reviews",
    authenticate,
    [
        param("bookId")
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("rate")
            .notEmpty()
            .withMessage("Vui lòng chọn số sao đánh giá.")
            .bail()
            .isInt({ min: 1, max: 5 })
            .withMessage("Số sao đánh giá phải từ 1 đến 5.")
            .bail()
            .toInt(),
        body("value")
            .optional({ nullable: true })
            .isString()
            .withMessage("Nội dung nhận xét phải là chuỗi ký tự.")
            .bail()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Nội dung nhận xét không được vượt quá 1000 ký tự.")
    ],
    validate,
    controller.createReview
);

router.put(
    "/reviews/:id",
    authenticate,
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID đánh giá phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("rate")
            .optional()
            .isInt({ min: 1, max: 5 })
            .withMessage("Số sao đánh giá phải từ 1 đến 5.")
            .bail()
            .toInt(),
        body("value")
            .optional({ nullable: true })
            .isString()
            .withMessage("Nội dung nhận xét phải là chuỗi ký tự.")
            .bail()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Nội dung nhận xét không được vượt quá 1000 ký tự.")
    ],
    validate,
    controller.updateReview
);

router.delete(
    "/reviews/:id",
    authenticate,
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID đánh giá phải là số nguyên dương.")
            .bail()
            .toInt()
    ],
    validate,
    controller.deleteReview
);

router.get(
    "/admin/reviews",
    authenticate,
    authorizeAdmin,
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
        query("bookId")
            .optional()
            .isInt({ min: 1 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        query("rate")
            .optional()
            .isInt({ min: 1, max: 5 })
            .withMessage("Số sao lọc phải từ 1 đến 5.")
            .bail()
            .toInt(),
        query("isDelete")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Trạng thái xóa phải là 0 hoặc 1.")
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
    controller.adminGetReviews
);

router.patch(
    "/admin/reviews/:id/status",
    authenticate,
    authorizeAdmin,
    [
        param("id")
            .isInt({ min: 1 })
            .withMessage("ID đánh giá phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("isDelete")
            .notEmpty()
            .withMessage("Trạng thái isDelete không được để trống.")
            .bail()
            .isIn([0, 1, "0", "1"])
            .withMessage("Trạng thái isDelete phải là 0 hoặc 1.")
            .bail()
            .toInt()
    ],
    validate,
    controller.adminChangeStatus
);

module.exports = router;

