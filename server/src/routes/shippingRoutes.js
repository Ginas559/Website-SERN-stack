const express = require("express");
const { param, body } = require("express-validator");
const controller = require("../controllers/shippingController");
const validate = require("../middleware/validateMiddleware");

const router = express.Router();

router.get("/provinces", controller.getProvinces);

router.get(
    "/districts/:provinceId",
    [
        param("provinceId")
            .isInt({ min: 1 })
            .withMessage("Mã tỉnh thành provinceId phải là số nguyên dương.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getDistricts
);

router.get(
    "/wards/:districtId",
    [
        param("districtId")
            .isInt({ min: 1 })
            .withMessage("Mã quận huyện districtId phải là số nguyên dương.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getWards
);

router.post(
    "/calculate-fee",
    [
        body("provinceId")
            .optional({ nullable: true })
            .isInt({ min: 1 })
            .withMessage("Mã tỉnh thành provinceId không hợp lệ.")
            .bail()
            .toInt(),
        body("provinceName")
            .optional({ nullable: true })
            .isString()
            .trim(),
        body("toDistrictId")
            .optional({ nullable: true })
            .isInt({ min: 1 })
            .withMessage("Mã quận huyện toDistrictId không hợp lệ.")
            .bail()
            .toInt(),
        body("toWardCode")
            .optional({ nullable: true })
            .isString()
            .trim(),
        body("orderTotal")
            .optional({ nullable: true })
            .isFloat({ min: 0 })
            .withMessage("Tổng tiền đơn hàng không hợp lệ.")
            .bail()
            .toFloat(),
        body("weightInGrams")
            .optional({ nullable: true })
            .isInt({ min: 1, max: 20000 })
            .withMessage("Khối lượng kiện hàng phải từ 1g đến 20.000g.")
            .bail()
            .toInt()
    ],
    validate,
    controller.calculateFee
);

router.get(
    "/track/:orderCode",
    [
        param("orderCode")
            .isString()
            .trim()
            .notEmpty()
            .withMessage("Mã vận đơn GHN không được để trống.")
            .bail()
    ],
    validate,
    controller.trackOrder
);

router.post("/webhook", controller.handleGhnWebhook);

module.exports = router;
