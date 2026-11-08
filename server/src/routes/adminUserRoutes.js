const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/userController");
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
        query("isDelete")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Cờ trạng thái xóa phải là 0 hoặc 1.")
            .bail()
            .toInt(),
        query("isAdmin")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Cờ quản trị viên phải là 0 hoặc 1.")
            .bail()
            .toInt(),
        query("isVerified")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Cờ xác thực phải là 0 hoặc 1.")
            .bail()
            .toInt(),
        query("isVip")
            .optional()
            .isIn(["0", "1", 0, 1])
            .withMessage("Cờ VIP phải là 0 hoặc 1.")
            .bail()
            .toInt(),
        query("sortBy")
            .optional()
            .isIn(["createdAt", "updatedAt", "username", "email", "full_name", "phone_number"])
            .withMessage("Trường sắp xếp không hợp lệ.")
            .bail(),
        query("sortOrder")
            .optional()
            .isIn(["ASC", "DESC", "asc", "desc"])
            .withMessage("Thứ tự sắp xếp phải là ASC hoặc DESC.")
            .bail()
    ],
    validate,
    controller.adminGetAll
);

router.get(
    "/:id",
    [
        param("id")
            .isUUID()
            .withMessage("ID người dùng không hợp lệ (phải là UUID).")
            .bail()
    ],
    validate,
    controller.adminGetById
);

router.patch(
    "/:id/status",
    [
        param("id")
            .isUUID()
            .withMessage("ID người dùng không hợp lệ (phải là UUID).")
            .bail(),
        body("isDelete")
            .isIn([0, 1, "0", "1"])
            .withMessage("Trạng thái isDelete phải là 0 hoặc 1.")
            .bail()
            .toInt(),
        body("blockReason")
            .optional({ nullable: true })
            .isString()
            .withMessage("Lý do chặn phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Lý do chặn không được vượt quá 255 ký tự.")
            .bail()
    ],
    validate,
    controller.adminChangeStatus
);

router.patch(
    "/:id/block",
    [
        param("id")
            .isUUID()
            .withMessage("ID người dùng không hợp lệ (phải là UUID).")
            .bail(),
        body("blockReason")
            .optional({ nullable: true })
            .isString()
            .withMessage("Lý do chặn phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Lý do chặn không được vượt quá 255 ký tự.")
            .bail(),
        body("reason")
            .optional({ nullable: true })
            .isString()
            .withMessage("Lý do chặn phải là chuỗi.")
            .bail()
            .trim()
            .isLength({ max: 255 })
            .withMessage("Lý do chặn không được vượt quá 255 ký tự.")
            .bail()
    ],
    validate,
    controller.adminBlockUser
);

router.patch(
    "/:id/restore",
    [
        param("id")
            .isUUID()
            .withMessage("ID người dùng không hợp lệ (phải là UUID).")
            .bail()
    ],
    validate,
    controller.adminRestoreUser
);

module.exports = router;

