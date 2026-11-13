const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/reviewController");
const validate = require("../middleware/validateMiddleware");
const { protect, optionalAuth, restrictTo } = require("../middleware/authMiddleware");

const MAX_INT32 = 2147483647;
const MAX_PAGE = 1000000;

const router = express.Router();

router.get("/reviews/my-reviewed-books", protect, controller.getMyReviewedBookIds);

router.get(
    "/books/:bookId/reviews",
    optionalAuth,
    [
        param("bookId")
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        query("page")
            .optional()
            .isInt({ min: 1, max: MAX_PAGE })
            .withMessage("Trang phải là số nguyên lớn hơn 0.")
            .bail()
            .toInt(),
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Số lượng mỗi trang phải từ 1 đến 50.")
            .bail()
            .toInt(),
        query("type")
            .optional()
            .isIn(["all", "reviews", "discussions"])
            .withMessage("Loại bài viết phải là all, reviews hoặc discussions.")
            .bail(),
        query("rate")
            .optional()
            .isInt({ min: 1, max: 5 })
            .withMessage("Số sao đánh giá phải là số nguyên từ 1 đến 5.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getBookReviews
);

router.post(
    "/books/:bookId/reviews",
    protect,
    [
        param("bookId")
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("parentId")
            .optional({ nullable: true })
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID bình luận gốc phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("rate")
            .optional({ nullable: true })
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
    protect,
    [
        param("id")
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID đánh giá phải là số nguyên dương.")
            .bail()
            .toInt(),
        body("rate")
            .optional({ nullable: true })
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
    protect,
    [
        param("id")
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID đánh giá phải là số nguyên dương.")
            .bail()
            .toInt()
    ],
    validate,
    controller.deleteReview
);

router.get(
    "/admin/reviews",
    protect,
    restrictTo("Admin"),
    [
        query("page")
            .optional()
            .isInt({ min: 1, max: MAX_PAGE })
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
            .isInt({ min: 1, max: MAX_INT32 })
            .withMessage("ID sách phải là số nguyên dương.")
            .bail()
            .toInt(),
        query("rate")
            .optional()
            .custom((val) => {
                if (val === "discussion" || (Number.isInteger(Number(val)) && Number(val) >= 1 && Number(val) <= 5)) {
                    return true;
                }
                throw new Error("Số sao lọc phải từ 1 đến 5 hoặc discussion.");
            })
            .bail(),
        query("type")
            .optional()
            .isIn(["all", "reviews", "discussions"])
            .withMessage("Loại bài viết phải là all, reviews hoặc discussions.")
            .bail(),
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
    protect,
    restrictTo("Admin"),
    [
        param("id")
            .isInt({ min: 1, max: MAX_INT32 })
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
