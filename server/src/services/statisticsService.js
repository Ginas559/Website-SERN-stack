const statisticsModel = require("../models/statisticsModel");
const AppError = require("../utils/AppError");

const VALID_TIME_RANGES = new Set(["7days", "14days", "30days", "thisMonth", "6months", "12months"]);
const VALID_GROUP_BY = new Set(["day", "month"]);

function parseStrictDate(dateStr, fieldName) {
    if (typeof dateStr !== "string") {
        throw new AppError(`Tham số ${fieldName} phải là chuỗi ngày YYYY-MM-DD.`, 400);
    }
    const trimmed = dateStr.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    if (!match) {
        throw new AppError(`Định dạng ${fieldName} không hợp lệ (cần YYYY-MM-DD).`, 400);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    if (localDate.getFullYear() !== year || localDate.getMonth() !== month - 1 || localDate.getDate() !== day) {
        throw new AppError(`Ngày ${fieldName} (${trimmed}) không tồn tại trên lịch.`, 400);
    }
    return localDate;
}

function parsePositiveIntLimit(limit, maxLimit, defaultLimit = 5, fieldLabel = "limit") {
    if (limit === undefined || limit === null || limit === "") {
        return defaultLimit;
    }
    if (typeof limit !== "number" && typeof limit !== "string") {
        throw new AppError(`Giới hạn (${fieldLabel}) phải là số nguyên từ 1 đến ${maxLimit}.`, 400);
    }
    const str = String(limit).trim();
    if (!/^\d+$/.test(str)) {
        throw new AppError(`Giới hạn (${fieldLabel}) phải là số nguyên từ 1 đến ${maxLimit}.`, 400);
    }
    const parsed = Number(str);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxLimit) {
        throw new AppError(`Giới hạn (${fieldLabel}) phải là số nguyên từ 1 đến ${maxLimit}.`, 400);
    }
    return parsed;
}

function formatDateStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatMonthStr(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
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

function generateMonthList(startDate, endDate) {
    const months = [];
    const curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (curr <= endMonth) {
        months.push(formatMonthStr(curr));
        curr.setMonth(curr.getMonth() + 1);
    }
    return months;
}

function resolveDateRange(timeRange, customStart, customEnd) {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);

    let start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if ((customStart && !customEnd) || (!customStart && customEnd)) {
        throw new AppError("Vui lòng cung cấp đầy đủ cả startDate và endDate.", 400);
    }

    if (customStart && customEnd) {
        const parsedStart = parseStrictDate(customStart, "startDate");
        const parsedEnd = parseStrictDate(customEnd, "endDate");
        parsedEnd.setHours(23, 59, 59, 999);

        if (parsedStart > parsedEnd) {
            throw new AppError("Ngày bắt đầu (startDate) không được lớn hơn ngày kết thúc (endDate).", 400);
        }

        const diffDays = Math.ceil((parsedEnd - parsedStart) / (1000 * 60 * 60 * 24));
        if (diffDays > 366) {
            throw new AppError("Khoảng thời gian tùy chọn không được vượt quá 366 ngày.", 400);
        }

        return { start: parsedStart, end: parsedEnd };
    }

    const effectiveRange = timeRange || "7days";
    if (!VALID_TIME_RANGES.has(effectiveRange)) {
        throw new AppError("Tham số timeRange phải là 7days, 14days, 30days, thisMonth, 6months hoặc 12months.", 400);
    }

    switch (effectiveRange) {
        case "12months":
            start = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
            break;
        case "6months":
            start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
            break;
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

async function getRevenueChart({ timeRange = "7days", startDate = null, endDate = null, groupBy = null }) {
    if (groupBy !== null && groupBy !== undefined && groupBy !== "" && !VALID_GROUP_BY.has(groupBy)) {
        throw new AppError("Tham số groupBy phải là day hoặc month.", 400);
    }

    const { start, end } = resolveDateRange(timeRange, startDate, endDate);
    const resolvedGroupBy = groupBy === "month" || (!groupBy && (timeRange === "6months" || timeRange === "12months"))
        ? "month"
        : "day";

    const [rawOrderData, rawUserData] = await Promise.all([
        statisticsModel.getRevenueAndOrdersTimeSeries({
            startDate: start,
            endDate: end,
            groupBy: resolvedGroupBy
        }),
        statisticsModel.getUsersTimeSeries({
            startDate: start,
            endDate: end,
            groupBy: resolvedGroupBy
        })
    ]);

    const orderMap = new Map();
    for (const row of rawOrderData) {
        orderMap.set(row.date, row);
    }

    const userMap = new Map();
    for (const row of rawUserData) {
        userMap.set(row.date, row.newUsersCount || 0);
    }

    const allPeriods = resolvedGroupBy === "month"
        ? generateMonthList(start, end)
        : generateDateList(start, end);

    const continuousData = allPeriods.map((periodStr) => {
        const foundOrder = orderMap.get(periodStr);
        const foundUsers = userMap.get(periodStr) || 0;
        if (foundOrder) {
            return {
                date: periodStr,
                ordersCount: foundOrder.ordersCount || 0,
                pendingOrdersCount: foundOrder.pendingOrdersCount || 0,
                shippingOrdersCount: foundOrder.shippingOrdersCount || 0,
                completedOrdersCount: foundOrder.completedOrdersCount || 0,
                cancelledOrdersCount: foundOrder.cancelledOrdersCount || 0,
                revenue: foundOrder.revenue || 0,
                pendingRevenue: foundOrder.pendingRevenue || 0,
                shippingRevenue: foundOrder.shippingRevenue || 0,
                vnpayRevenue: foundOrder.vnpayRevenue || 0,
                codRevenue: foundOrder.codRevenue || 0,
                newUsersCount: foundUsers
            };
        }
        return {
            date: periodStr,
            ordersCount: 0,
            pendingOrdersCount: 0,
            shippingOrdersCount: 0,
            completedOrdersCount: 0,
            cancelledOrdersCount: 0,
            revenue: 0,
            pendingRevenue: 0,
            shippingRevenue: 0,
            vnpayRevenue: 0,
            codRevenue: 0,
            newUsersCount: foundUsers
        };
    });

    const totalPeriodRevenue = continuousData.reduce((acc, cur) => acc + cur.revenue, 0);
    const totalPeriodPendingRevenue = continuousData.reduce((acc, cur) => acc + cur.pendingRevenue, 0);
    const totalPeriodShippingRevenue = continuousData.reduce((acc, cur) => acc + cur.shippingRevenue, 0);
    const totalPeriodReconciledRevenue = continuousData.reduce((acc, cur) => acc + cur.vnpayRevenue, 0);
    const totalPeriodUnreconciledRevenue = continuousData.reduce((acc, cur) => acc + cur.codRevenue, 0);
    const totalPeriodOrders = continuousData.reduce((acc, cur) => acc + cur.ordersCount, 0);
    const totalPeriodCompleted = continuousData.reduce((acc, cur) => acc + cur.completedOrdersCount, 0);
    const totalPeriodNewUsers = continuousData.reduce((acc, cur) => acc + cur.newUsersCount, 0);

    return {
        timeRange,
        groupBy: resolvedGroupBy,
        startDate: formatDateStr(start),
        endDate: formatDateStr(end),
        summary: {
            totalRevenue: totalPeriodRevenue,
            pendingRevenue: totalPeriodPendingRevenue,
            shippingRevenue: totalPeriodShippingRevenue,
            reconciledRevenue: totalPeriodReconciledRevenue,
            unreconciledRevenue: totalPeriodUnreconciledRevenue,
            totalOrders: totalPeriodOrders,
            completedOrders: totalPeriodCompleted,
            totalNewUsers: totalPeriodNewUsers
        },
        chartData: continuousData
    };
}

async function getTopBooks({ limit = 5 }) {
    const parsedLimit = parsePositiveIntLimit(limit, 50, 5, "số sách");
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

async function getPromotionAnalytics({ timeRange = null, startDate = null, endDate = null } = {}) {
    let rangeBounds = { start: null, end: null };
    if (timeRange || startDate || endDate) {
        rangeBounds = resolveDateRange(timeRange || "7days", startDate, endDate);
    }

    const { promotions, adoption } = await statisticsModel.getPromotionAnalytics({
        startDate: rangeBounds.start,
        endDate: rangeBounds.end
    });

    const now = new Date();
    const enrichedPromotions = promotions.map((p) => {
        const qty = Number(p.quantity) || 0;
        const used = Number(p.usedCount) || 0;
        let status = "active";
        if (p.expiredAt && new Date(p.expiredAt) < now) {
            status = "expired";
        } else if (p.startDate && new Date(p.startDate) > now) {
            status = "scheduled";
        } else if (used >= qty) {
            status = "exhausted";
        }
        return {
            ...p,
            remaining: Math.max(0, qty - used),
            usageRate: qty > 0 ? Number(Math.min(100, (used / qty) * 100).toFixed(1)) : 0,
            status
        };
    });

    const totalOrders = Number(adoption.totalOrders) || 0;
    const ordersWithPromo = Number(adoption.ordersWithPromo) || 0;
    const ordersWithoutPromo = Number(adoption.ordersWithoutPromo) || 0;

    return {
        adoption: {
            totalOrders,
            ordersWithPromo,
            ordersWithoutPromo,
            promoRate: totalOrders > 0 ? Number(((ordersWithPromo / totalOrders) * 100).toFixed(1)) : 0,
            promoRevenue: Number(adoption.promoRevenue) || 0,
            regularRevenue: Number(adoption.regularRevenue) || 0
        },
        topPromotions: enrichedPromotions
    };
}

async function getReviewAnalytics({ limit = 5, preloadedReviews = null } = {}) {
    const parsedLimit = parsePositiveIntLimit(limit, 20, 5, "số sách đánh giá");

    const [reviewsSummary, topRatedBooks] = await Promise.all([
        preloadedReviews ? Promise.resolve(preloadedReviews) : getOverview().then((ov) => ov.reviews),
        statisticsModel.getTopRatedBooks({ limit: parsedLimit })
    ]);

    const totalRatings = Number(reviewsSummary?.totalRatings) || 0;
    const totalDiscussions = Number(reviewsSummary?.totalDiscussions) || 0;
    const totalPosts = totalRatings + totalDiscussions;
    const breakdown = reviewsSummary?.ratingBreakdown || {};

    const stars = [5, 4, 3, 2, 1].map((star) => {
        const count = Number(breakdown[star]) || 0;
        return {
            star,
            count,
            percentage: totalRatings > 0 ? Number(((count / totalRatings) * 100).toFixed(1)) : 0
        };
    });

    return {
        totalRatings,
        totalDiscussions,
        totalPosts,
        averageRate: Number(reviewsSummary?.averageRate) || 0,
        ratingShare: totalPosts > 0 ? Number(((totalRatings / totalPosts) * 100).toFixed(1)) : 0,
        discussionShare: totalPosts > 0 ? Number(((totalDiscussions / totalPosts) * 100).toFixed(1)) : 0,
        stars,
        topRatedBooks
    };
}

async function getDashboardSummary({ timeRange = "7days", startDate = null, endDate = null, groupBy = null }) {
    const [overview, revenueChart, topBooks, categories, recentOrders, promotionAnalytics] = await Promise.all([
        getOverview(),
        getRevenueChart({ timeRange, startDate, endDate, groupBy }),
        getTopBooks({ limit: 5 }),
        getCategoryDistribution(),
        statisticsModel.getRecentOrders({ limit: 5 }),
        getPromotionAnalytics({ timeRange, startDate, endDate })
    ]);

    const reviewAnalytics = await getReviewAnalytics({ limit: 5, preloadedReviews: overview.reviews });

    return {
        overview,
        revenueChart,
        topBooks,
        categories,
        recentOrders,
        promotionAnalytics,
        reviewAnalytics
    };
}

module.exports = {
    getOverview,
    getRevenueChart,
    getTopBooks,
    getCategoryDistribution,
    getPromotionAnalytics,
    getReviewAnalytics,
    getDashboardSummary
};

