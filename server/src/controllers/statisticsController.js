const statisticsService = require("../services/statisticsService");

async function getOverview(req, res) {
    const data = await statisticsService.getOverview();
    res.json(data);
}

async function getRevenueChart(req, res) {
    const { timeRange, startDate, endDate } = req.query;
    const data = await statisticsService.getRevenueChart({ timeRange, startDate, endDate });
    res.json(data);
}

async function getTopBooks(req, res) {
    const { limit } = req.query;
    const data = await statisticsService.getTopBooks({ limit });
    res.json(data);
}

async function getCategoryDistribution(req, res) {
    const data = await statisticsService.getCategoryDistribution();
    res.json(data);
}

async function getDashboardSummary(req, res) {
    const { timeRange, startDate, endDate } = req.query;
    const data = await statisticsService.getDashboardSummary({ timeRange, startDate, endDate });
    res.json(data);
}

module.exports = {
    getOverview,
    getRevenueChart,
    getTopBooks,
    getCategoryDistribution,
    getDashboardSummary
};

