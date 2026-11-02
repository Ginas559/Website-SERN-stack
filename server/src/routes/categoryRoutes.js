
const express = require("express");
const { body, param } = require("express-validator");
const controller = require("../controllers/categoryController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

router.get("/", controller.getAll);

router.get(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID thể loại không hợp lệ."),
    ],
    validate,
    controller.getById
);

router.post(
    "/",
    [
        body("name")
            .isString()
            .withMessage("Tên thể loại phải là chuỗi.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Tên thể loại không được để trống.")
            .isLength({ max: 255 })
            .withMessage("Tên thể loại không được vượt quá 255 ký tự."),
        body("description")
            .optional({ values: "null" })
            .isString()
            .withMessage("Mô tả thể loại phải là chuỗi.")
            .bail()
            .trim(),
        body("image")
            .optional({ values: "null" })
            .isString()
            .withMessage("Ảnh thể loại phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Ảnh thể loại không được vượt quá 255 ký tự."),
    ],
    validate,
    controller.create
);

router.put(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID thể loại không hợp lệ."),
        body("name")
            .optional()
            .isString()
            .withMessage("Tên thể loại phải là chuỗi.")
            .bail()
            .trim()
            .notEmpty()
            .withMessage("Tên thể loại không được để trống.")
            .isLength({ max: 255 })
            .withMessage("Tên thể loại không được vượt quá 255 ký tự."),
        body("description")
            .optional({ values: "null" })
            .isString()
            .withMessage("Mô tả thể loại phải là chuỗi.")
            .bail()
            .trim(),
        body("image")
            .optional({ values: "null" })
            .isString()
            .withMessage("Ảnh thể loại phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Ảnh thể loại không được vượt quá 255 ký tự."),
    ],
    validate,
    controller.update
);

router.patch(
    "/:id/status",
    [
        param("id").isInt({ min: 1 }).withMessage("ID thể loại không hợp lệ."),
        body("isDelete").isIn([0, 1]).withMessage("Trạng thái isDelete phải là 0 hoặc 1."),
    ],
    validate,
    controller.changeStatus
);

module.exports = router;
