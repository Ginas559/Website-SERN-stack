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
        body("name").trim().notEmpty().withMessage("Tên thể loại không được để trống."),
        body("description").optional().trim(),
        body("image").optional().trim(),
    ],
    validate,
    controller.create
);

router.put(
    "/:id",
    [
        param("id").isInt({ min: 1 }).withMessage("ID thể loại không hợp lệ."),
        body("name").optional().trim().notEmpty().withMessage("Tên thể loại không được để trống."),
        body("description").optional().trim(),
        body("image").optional().trim(),
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
