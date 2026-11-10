const statisticsModel = require("../models/statisticsModel");
const AppError = require("../utils/AppError");

function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function generateDateList(startDate, endDate) {
    const dates = [];
    const curr = new Date(startDate);
    curr.setHours(0, 0, 0, 0);

    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    while (curr <= end) {
        dates.push(formatDateStr(curr));
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

function resolveDateRange(timeRange, customStart, customEnd) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (customStart && customEnd) {
        const parsedStart = new Date(customStart);
        const parsedEnd = new Date(customEnd);

        if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
            throw new AppError("Định dạng ngày tùy chọn không hợp lệ (cần YYYY-MM-DD).", 400);
        }
        if (parsedStart > parsedEnd) {
            throw new AppError("Ngày bắt đầu không được lớn hơn ngày kết thúc.", 400);
        }

        parsedStart.setHours(0, 0, 0, 0);
        parsedEnd.setHours(23, 59, 59, 999);
        return { start: parsedStart, end: parsedEnd };
    }

    switch (timeRange) {
        case "30days":
            start.setDate(now.getDate() - 29);
            break;
        case "thisMonth":
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
            break;
        case "14days":
            start.setDate(now.getDate() - 13);
            break;
        case "7days":
        default:
            start.setDate(now.getDate() - 6);
            break;
    }

    return { start, end };
}

async function getOverview() {
    return await statisticsModel.getOverviewMetrics();
}

async function getRevenueChart({ timeRange = "7days", startDate = null, endDate = null }) {
    const { start, end } = resolveDateRange(timeRange, startDate, endDate);
    const rawData = await statisticsModel.getRevenueAndOrdersTimeSeries({
        startDate: start,
        endDate: end
    });

    const dataMap = new Map();
    for (const row of rawData) {
        dataMap.set(row.date, row);
    }

    const allDates = generateDateList(start, end);
    const continuousData = allDates.map((dateStr) => {
        const found = dataMap.get(dateStr);
        if (found) {
            return {
                date: dateStr,
                ordersCount: found.ordersCount || 0,
                completedOrdersCount: found.completedOrdersCount || 0,
                cancelledOrdersCount: found.cancelledOrdersCount || 0,
                revenue: found.revenue || 0,
                vnpayRevenue: found.vnpayRevenue || 0,
                codRevenue: found.codRevenue || 0
            };
        }
        return {
            date: dateStr,
            ordersCount: 0,
            completedOrdersCount: 0,
            cancelledOrdersCount: 0,
            revenue: 0,
            vnpayRevenue: 0,
            codRevenue: 0
        };
    });

    const totalPeriodRevenue = continuousData.reduce((acc, cur) => acc + cur.revenue, 0);
    const totalPeriodOrders = continuousData.reduce((acc, cur) => acc + cur.ordersCount, 0);
    const totalPeriodCompleted = continuousData.reduce((acc, cur) => acc + cur.completedOrdersCount, 0);

    return {
        timeRange,
        startDate: formatDateStr(start),
        endDate: formatDateStr(end),
        summary: {
            totalRevenue: totalPeriodRevenue,
            totalOrders: totalPeriodOrders,
            completedOrders: totalPeriodCompleted
        },
        chartData: continuousData
    };
}

async function getTopBooks({ limit = 5 }) {
    const parsedLimit = Number(limit) || 5;
    if (parsedLimit < 1 || parsedLimit > 50) {
        throw new AppError("Giới hạn số sách phải từ 1 đến 50.", 400);
    }
    return await statisticsModel.getTopSellingBooks({ limit: parsedLimit });
}

async function getCategoryDistribution() {
    const rawCategories = await statisticsModel.getCategoryDistribution();
    const totalBooksAll = rawCategories.reduce((acc, cur) => acc + cur.bookCount, 0);
    const totalRevenueAll = rawCategories.reduce((acc, cur) => acc + cur.totalRevenue, 0);

    return rawCategories.map((cat) => ({
        ...cat,
        bookPercentage: totalBooksAll > 0 ? Number(((cat.bookCount / totalBooksAll) * 100).toFixed(1)) : 0,
        revenuePercentage: totalRevenueAll > 0 ? Number(((cat.totalRevenue / totalRevenueAll) * 100).toFixed(1)) : 0
    }));
}

async function getDashboardSummary({ timeRange = "7days", startDate = null, endDate = null }) {
    const [overview, revenueChart, topBooks, categories, recentOrders] = await Promise.all([
        getOverview(),
        getRevenueChart({ timeRange, startDate, endDate }),
        getTopBooks({ limit: 5 }),
        getCategoryDistribution(),
        statisticsModel.getRecentOrders({ limit: 5 })
    ]);

    return {
        overview,
        revenueChart,
        topBooks,
        categories,
        recentOrders
    };
}

module.exports = {
    getOverview,
    getRevenueChart,
    getTopBooks,
    getCategoryDistribution,
    getDashboardSummary
};

