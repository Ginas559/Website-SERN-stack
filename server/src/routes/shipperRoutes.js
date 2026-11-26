const express = require("express");
const { body, param, query } = require("express-validator");
const controller = require("../controllers/shipperController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Shipper"));

router.get(
    "/assignments",
    [
        query("status")
            .optional()
            .isIn(["ASSIGNED", "ACCEPTED", "REJECTED", "COMPLETED", "CANCELLED"])
            .withMessage("Trạng thái phân công không hợp lệ.")
            .bail(),
        query("search")
            .optional()
            .isString()
            .withMessage("Từ khóa tìm kiếm không hợp lệ.")
            .bail()
            .trim()
            .isLength({ max: 100 })
            .withMessage("Từ khóa tìm kiếm không được vượt quá 100 ký tự.")
            .bail(),
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
            .toInt()
    ],
    validate,
    controller.getAssignments
);

router.patch(
    "/assignments/:id/accept",
    [
        param("id")
            .isUUID()
            .withMessage("Mã phân công không hợp lệ (phải là UUID).")
            .bail()
    ],
    validate,
    controller.acceptAssignment
);

router.patch(
    "/assignments/:id/reject",
    [
        param("id")
            .isUUID()
            .withMessage("Mã phân công không hợp lệ (phải là UUID).")
            .bail(),
        body("reason")
            .notEmpty()
            .withMessage("Lý do từ chối nhận đơn không được để trống.")
            .bail()
            .isString()
            .trim()
            .isLength({ min: 1, max: 500 })
            .withMessage("Lý do từ chối phải dài từ 1 đến 500 ký tự.")
            .bail()
    ],
    validate,
    controller.rejectAssignment
);

router.patch(
    "/assignments/:id/complete",
    [
        param("id")
            .isUUID()
            .withMessage("Mã phân công không hợp lệ (phải là UUID).")
            .bail(),
        body("note")
            .optional({ nullable: true })
            .isString()
            .trim()
            .isLength({ max: 1000 })
            .withMessage("Ghi chú hoàn tất giao hàng không được vượt quá 1000 ký tự.")
            .bail()
        ,
        body("codCollected")
            .optional({ nullable: true })
            .isBoolean()
            .withMessage("Xác nhận thu COD không hợp lệ.")
            .bail()
            .toBoolean()
    ],
    validate,
    controller.completeAssignment
);

module.exports = router;
