const express = require("express");
const { query } = require("express-validator");
const controller = require("../controllers/statisticsController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

const chartQueryValidators = [
    query("timeRange")
        .optional()
        .isIn(["7days", "14days", "30days", "thisMonth", "6months", "12months"])
        .withMessage("Khoảng thời gian phải là 7days, 14days, 30days, thisMonth, 6months hoặc 12months.")
        .bail(),
    query("groupBy")
        .optional()
        .isIn(["day", "month"])
        .withMessage("Nhóm thời gian phải là day hoặc month.")
        .bail(),
    query("startDate")
        .optional()
        .isISO8601()
        .withMessage("startDate phải theo định dạng ngày ISO8601 (YYYY-MM-DD).")
        .bail(),
    query("endDate")
        .optional()
        .isISO8601()
        .withMessage("endDate phải theo định dạng ngày ISO8601 (YYYY-MM-DD).")
        .bail()
];

router.get("/overview", controller.getOverview);

router.get("/revenue-orders", chartQueryValidators, validate, controller.getRevenueChart);

router.get(
    "/top-books",
    [
        query("limit")
            .optional()
            .isInt({ min: 1, max: 50 })
            .withMessage("Số lượng limit phải là số nguyên từ 1 đến 50.")
            .bail()
            .toInt()
    ],
    validate,
    controller.getTopBooks
);

router.get("/categories", controller.getCategoryDistribution);

router.get("/summary", chartQueryValidators, validate, controller.getDashboardSummary);

module.exports = router;

