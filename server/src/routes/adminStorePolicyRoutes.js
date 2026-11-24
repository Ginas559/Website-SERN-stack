const express = require("express");
const { body } = require("express-validator");
const controller = require("../controllers/storePolicyController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

router.get("/", controller.adminGetAllPolicies);
router.get("/shipping", controller.adminGetShippingPolicy);

router.put(
    "/shipping",
    [
        body("standardFee")
            .exists({ checkFalsy: false })
            .withMessage("Vui lòng nhập phí giao hàng tiêu chuẩn.")
            .bail()
            .isInt({ min: 0, max: 10000000 })
            .withMessage("Phí giao hàng tiêu chuẩn phải là số nguyên từ 0 đến 10.000.000đ.")
            .bail()
            .toInt(),
        body("freeThreshold")
            .exists({ checkFalsy: false })
            .withMessage("Vui lòng nhập ngưỡng miễn phí vận chuyển.")
            .bail()
            .isInt({ min: 0, max: 1000000000 })
            .withMessage("Ngưỡng miễn phí vận chuyển phải là số nguyên từ 0 đến 1.000.000.000đ.")
            .bail()
            .toInt(),
        body("expectedUpdatedAt")
            .optional({ nullable: true })
            .isISO8601()
            .withMessage("Mốc thời gian cập nhật không hợp lệ.")
            .bail()
    ],
    validate,
    controller.adminUpdateShippingPolicy
);

module.exports = router;

