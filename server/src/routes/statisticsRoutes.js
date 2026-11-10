const express = require("express");
const { query } = require("express-validator");
const controller = require("../controllers/statisticsController");
const validate = require("../middleware/validateMiddleware");
const { protect, restrictTo } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, restrictTo("Admin"));

router.get("/overview", controller.getOverview);

router.get(
    "/revenue-orders",
    [
        query("timeRange")
            .optional()
            .isIn(["7days", "14days", "30days", "thisMonth"])
            .withMessage("Khoảng thời gian phải là 7days, 14days, 30days hoặc thisMonth.")
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
    ],
    validate,
    controller.getRevenueChart
);

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

router.get(
    "/summary",
    [
        query("timeRange")
            .optional()
            .isIn(["7days", "14days", "30days", "thisMonth"])
            .withMessage("Khoảng thời gian phải là 7days, 14days, 30days hoặc thisMonth.")
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
    ],
    validate,
    controller.getDashboardSummary
);

module.exports = router;

