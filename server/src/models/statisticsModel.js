const { sql, connectDB } = require("../config/connectDB");

async function getOverviewMetrics() {
    const pool = await connectDB();

    const ordersQuery = `
        SELECT 
            COUNT(1) AS totalOrders,
            COALESCE(SUM(CASE WHEN status = 3 THEN total ELSE 0 END), 0) AS totalRevenue,
            COALESCE(SUM(CASE WHEN status = 0 THEN total ELSE 0 END), 0) AS pendingRevenue,
            COALESCE(SUM(CASE WHEN status IN (1, 2) THEN total ELSE 0 END), 0) AS shippingRevenue,
            COALESCE(SUM(CASE WHEN status = 4 THEN total ELSE 0 END), 0) AS cancelledRevenue,
            COUNT(CASE WHEN status = 0 THEN 1 END) AS pendingOrders,
            COUNT(CASE WHEN status = 1 THEN 1 END) AS paidOrders,
            COUNT(CASE WHEN status = 2 THEN 1 END) AS shippingOrders,
            COUNT(CASE WHEN status = 3 THEN 1 END) AS completedOrders,
            COUNT(CASE WHEN status = 4 THEN 1 END) AS cancelledOrders,
            COUNT(CASE WHEN payment_method = 'COD' THEN 1 END) AS codOrders,
            COUNT(CASE WHEN payment_method = 'VNPAY' THEN 1 END) AS vnpayOrders,
            COALESCE(SUM(CASE WHEN payment_method = 'COD' AND status = 3 THEN total ELSE 0 END), 0) AS codRevenue,
            COALESCE(SUM(CASE WHEN payment_method = 'VNPAY' AND status = 3 THEN total ELSE 0 END), 0) AS vnpayRevenue
        FROM dbo.orders
    `;

    const booksQuery = `
        SELECT 
            COUNT(1) AS totalBooks,
            COUNT(CASE WHEN quantity = 0 THEN 1 END) AS outOfStockBooks,
            COUNT(CASE WHEN quantity > 0 AND quantity <= 10 THEN 1 END) AS lowStockBooks,
            COUNT(CASE WHEN quantity > 10 THEN 1 END) AS inStockBooks,
            COALESCE(SUM(quantity), 0) AS totalInventoryQuantity
        FROM dbo.books
        WHERE isDelete = 0
    `;

    const usersQuery = `
        SELECT 
            COUNT(1) AS totalUsers,
            COUNT(CASE WHEN isAdmin = 0 OR isAdmin IS NULL THEN 1 END) AS totalCustomers,
            COUNT(CASE WHEN isVip = 1 AND (isAdmin = 0 OR isAdmin IS NULL) THEN 1 END) AS vipCustomers,
            COUNT(CASE WHEN isAdmin = 1 THEN 1 END) AS adminCount
        FROM dbo.Users
        WHERE isDelete = 0
    `;

    const reviewsQuery = `
        SELECT 
            COUNT(CASE WHEN parent_id IS NULL AND rate IS NOT NULL THEN 1 END) AS totalReviews,
            COUNT(CASE WHEN parent_id IS NULL AND rate IS NULL THEN 1 END) AS totalDiscussions,
            CAST(ROUND(COALESCE(AVG(CAST(CASE WHEN parent_id IS NULL THEN rate END AS FLOAT)), 0), 1) AS FLOAT) AS avgRating,
            COUNT(CASE WHEN parent_id IS NULL AND rate = 5 THEN 1 END) AS count5Star,
            COUNT(CASE WHEN parent_id IS NULL AND rate = 4 THEN 1 END) AS count4Star,
            COUNT(CASE WHEN parent_id IS NULL AND rate = 3 THEN 1 END) AS count3Star,
            COUNT(CASE WHEN parent_id IS NULL AND rate = 2 THEN 1 END) AS count2Star,
            COUNT(CASE WHEN parent_id IS NULL AND rate = 1 THEN 1 END) AS count1Star
        FROM dbo.comments
        WHERE isDelete = 0
    `;

    const promotionsQuery = `
        SELECT 
            COUNT(1) AS totalPromotions,
            COUNT(CASE WHEN isDelete = 0 AND (expiredAt IS NULL OR expiredAt > SYSUTCDATETIME()) AND quantity > usedCount THEN 1 END) AS activePromotions,
            COALESCE(SUM(usedCount), 0) AS totalVouchersUsed
        FROM dbo.discounts
        WHERE isDelete = 0
    `;

    const [ordersRes, booksRes, usersRes, reviewsRes, promosRes] = await Promise.all([
        pool.request().query(ordersQuery),
        pool.request().query(booksQuery),
        pool.request().query(usersQuery),
        pool.request().query(reviewsQuery),
        pool.request().query(promotionsQuery)
    ]);

    const o = ordersRes.recordset[0] || {};
    const b = booksRes.recordset[0] || {};
    const u = usersRes.recordset[0] || {};
    const r = reviewsRes.recordset[0] || {};
    const p = promosRes.recordset[0] || {};

    return {
        revenue: {
            total: o.totalRevenue || 0,
            cod: o.codRevenue || 0,
            vnpay: o.vnpayRevenue || 0,
            pending: o.pendingRevenue || 0,
            shipping: o.shippingRevenue || 0,
            cancelled: o.cancelledRevenue || 0,
            reconciled: o.vnpayRevenue || 0,
            unreconciled: o.codRevenue || 0
        },
        orders: {
            total: o.totalOrders || 0,
            pending: o.pendingOrders || 0,
            paid: o.paidOrders || 0,
            shipping: o.shippingOrders || 0,
            completed: o.completedOrders || 0,
            cancelled: o.cancelledOrders || 0,
            byPaymentMethod: {
                cod: o.codOrders || 0,
                vnpay: o.vnpayOrders || 0
            }
        },
        books: {
            total: b.totalBooks || 0,
            inStock: b.inStockBooks || 0,
            outOfStock: b.outOfStockBooks || 0,
            lowStock: b.lowStockBooks || 0,
            totalInventory: b.totalInventoryQuantity || 0
        },
        users: {
            total: u.totalUsers || 0,
            customers: u.totalCustomers || 0,
            vip: u.vipCustomers || 0,
            admins: u.adminCount || 0
        },
        reviews: {
            totalRatings: r.totalReviews || 0,
            totalDiscussions: r.totalDiscussions || 0,
            averageRate: r.avgRating || 0,
            ratingBreakdown: {
                5: r.count5Star || 0,
                4: r.count4Star || 0,
                3: r.count3Star || 0,
                2: r.count2Star || 0,
                1: r.count1Star || 0
            }
        },
        promotions: {
            total: p.totalPromotions || 0,
            active: p.activePromotions || 0,
            totalUsed: p.totalVouchersUsed || 0
        }
    };
}

async function getRevenueAndOrdersTimeSeries({ startDate, endDate, groupBy = "day" }) {
    const pool = await connectDB();
    const req = pool.request();
    const dateLen = groupBy === "month" ? 7 : 10;

    let whereClause = "";
    if (startDate && endDate) {
        whereClause = "WHERE createdAt >= @startDate AND createdAt <= @endDate";
        req.input("startDate", sql.DateTime, new Date(startDate));
        req.input("endDate", sql.DateTime, new Date(endDate));
    } else if (startDate) {
        whereClause = "WHERE createdAt >= @startDate";
        req.input("startDate", sql.DateTime, new Date(startDate));
    }

    const query = `
        SELECT 
            CONVERT(VARCHAR(${dateLen}), createdAt, 120) AS [date],
            COUNT(1) AS ordersCount,
            COUNT(CASE WHEN status = 0 THEN 1 END) AS pendingOrdersCount,
            COUNT(CASE WHEN status IN (1, 2) THEN 1 END) AS shippingOrdersCount,
            COUNT(CASE WHEN status = 3 THEN 1 END) AS completedOrdersCount,
            COUNT(CASE WHEN status = 4 THEN 1 END) AS cancelledOrdersCount,
            COALESCE(SUM(CASE WHEN status = 3 THEN total ELSE 0 END), 0) AS revenue,
            COALESCE(SUM(CASE WHEN status = 0 THEN total ELSE 0 END), 0) AS pendingRevenue,
            COALESCE(SUM(CASE WHEN status IN (1, 2) THEN total ELSE 0 END), 0) AS shippingRevenue,
            COALESCE(SUM(CASE WHEN status = 3 AND payment_method = 'VNPAY' THEN total ELSE 0 END), 0) AS vnpayRevenue,
            COALESCE(SUM(CASE WHEN status = 3 AND payment_method = 'COD' THEN total ELSE 0 END), 0) AS codRevenue
        FROM dbo.orders
        ${whereClause}
        GROUP BY CONVERT(VARCHAR(${dateLen}), createdAt, 120)
        ORDER BY [date] ASC
    `;

    const res = await req.query(query);
    return res.recordset;
}

async function getUsersTimeSeries({ startDate, endDate, groupBy = "day" }) {
    const pool = await connectDB();
    const req = pool.request();
    const dateLen = groupBy === "month" ? 7 : 10;

    let dateCondition = "";
    if (startDate && endDate) {
        dateCondition = "AND createdAt >= @startDate AND createdAt <= @endDate";
        req.input("startDate", sql.DateTime, new Date(startDate));
        req.input("endDate", sql.DateTime, new Date(endDate));
    } else if (startDate) {
        dateCondition = "AND createdAt >= @startDate";
        req.input("startDate", sql.DateTime, new Date(startDate));
    }

    const query = `
        SELECT 
            CONVERT(VARCHAR(${dateLen}), createdAt, 120) AS [date],
            COUNT(1) AS newUsersCount
        FROM dbo.Users
        WHERE isDelete = 0 AND (isAdmin = 0 OR isAdmin IS NULL)
        ${dateCondition}
        GROUP BY CONVERT(VARCHAR(${dateLen}), createdAt, 120)
        ORDER BY [date] ASC
    `;

    const res = await req.query(query);
    return res.recordset;
}

async function getTopSellingBooks({ limit = 5 }) {
    const pool = await connectDB();
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 5));

    const req = pool.request().input("limit", sql.Int, safeLimit);
    const query = `
        SELECT TOP (@limit)
            b.id,
            b.title,
            b.author,
            b.price,
            b.discount,
            b.image,
            b.quantity AS currentStock,
            COALESCE(SUM(od.quantity), 0) AS totalSold,
            COALESCE(SUM(od.total), 0) AS totalRevenue
        FROM dbo.order_details od
        JOIN dbo.orders o ON od.order_id = o.id
        JOIN dbo.books b ON od.book_id = b.id
        WHERE o.status = 3 AND b.isDelete = 0
        GROUP BY b.id, b.title, b.author, b.price, b.discount, b.image, b.quantity
        ORDER BY totalSold DESC, totalRevenue DESC
    `;

    const res = await req.query(query);
    return res.recordset;
}

async function getCategoryDistribution() {
    const pool = await connectDB();
    const query = `
        SELECT 
            c.id,
            c.name,
            COUNT(DISTINCT b.id) AS bookCount,
            COALESCE(SUM(CASE WHEN o.status = 3 THEN od.quantity ELSE 0 END), 0) AS totalSold,
            COALESCE(SUM(CASE WHEN o.status = 3 THEN od.total ELSE 0 END), 0) AS totalRevenue
        FROM dbo.categories c
        LEFT JOIN dbo.book_categories bc ON c.id = bc.category_id
        LEFT JOIN dbo.books b ON bc.book_id = b.id AND b.isDelete = 0
        LEFT JOIN dbo.order_details od ON b.id = od.book_id
        LEFT JOIN dbo.orders o ON od.order_id = o.id
        WHERE c.isDelete = 0
        GROUP BY c.id, c.name
        ORDER BY bookCount DESC, totalSold DESC, c.id ASC
    `;

    const res = await pool.request().query(query);
    return res.recordset;
}

async function getPromotionAnalytics({ startDate = null, endDate = null } = {}) {
    const pool = await connectDB();
    const adoptionReq = pool.request();

    let whereClause = "";
    if (startDate && endDate) {
        whereClause = "WHERE createdAt >= @startDate AND createdAt <= @endDate";
        adoptionReq.input("startDate", sql.DateTime, new Date(startDate));
        adoptionReq.input("endDate", sql.DateTime, new Date(endDate));
    } else if (startDate) {
        whereClause = "WHERE createdAt >= @startDate";
        adoptionReq.input("startDate", sql.DateTime, new Date(startDate));
    }

    const topPromotionsQuery = `
        SELECT TOP 8
            id,
            code,
            discount_type,
            value,
            minimumOrderValue,
            maxDiscountValue,
            quantity,
            usedCount,
            startDate,
            expiredAt
        FROM dbo.discounts
        WHERE isDelete = 0
        ORDER BY usedCount DESC, id ASC
    `;

    const adoptionQuery = `
        SELECT
            COUNT(1) AS totalOrders,
            COUNT(CASE WHEN discount IS NOT NULL THEN 1 END) AS ordersWithPromo,
            COUNT(CASE WHEN discount IS NULL THEN 1 END) AS ordersWithoutPromo,
            COALESCE(SUM(CASE WHEN status = 3 AND discount IS NOT NULL THEN total ELSE 0 END), 0) AS promoRevenue,
            COALESCE(SUM(CASE WHEN status = 3 AND discount IS NULL THEN total ELSE 0 END), 0) AS regularRevenue
        FROM dbo.orders
        ${whereClause}
    `;

    const [promosRes, adoptionRes] = await Promise.all([
        pool.request().query(topPromotionsQuery),
        adoptionReq.query(adoptionQuery)
    ]);

    return {
        promotions: promosRes.recordset,
        adoption: adoptionRes.recordset[0] || {}
    };
}

async function getTopRatedBooks({ limit = 5 } = {}) {
    const pool = await connectDB();
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));

    const req = pool.request().input("limit", sql.Int, safeLimit);
    const query = `
        SELECT TOP (@limit)
            b.id,
            b.title,
            b.author,
            b.image,
            COUNT(c.id) AS reviewCount,
            CAST(ROUND(AVG(CAST(c.rate AS FLOAT)), 1) AS FLOAT) AS avgRating
        FROM dbo.comments c
        JOIN dbo.books b ON c.book_id = b.id
        WHERE c.isDelete = 0 AND c.rate IS NOT NULL AND b.isDelete = 0
        GROUP BY b.id, b.title, b.author, b.image
        ORDER BY avgRating DESC, reviewCount DESC, b.id ASC
    `;

    const res = await req.query(query);
    return res.recordset;
}

async function getRecentOrders({ limit = 5 }) {
    const pool = await connectDB();
    const safeLimit = Math.max(1, Math.min(20, Number(limit) || 5));

    const req = pool.request().input("limit", sql.Int, safeLimit);
    const query = `
        SELECT TOP (@limit)
            o.id,
            o.user_id,
            o.total,
            o.status,
            o.payment_method,
            o.createdAt,
            u.full_name AS customerName,
            u.email AS customerEmail
        FROM dbo.orders o
        LEFT JOIN dbo.Users u ON o.user_id = u.id
        ORDER BY o.createdAt DESC
    `;

    const res = await req.query(query);
    return res.recordset;
}

module.exports = {
    getOverviewMetrics,
    getRevenueAndOrdersTimeSeries,
    getUsersTimeSeries,
    getTopSellingBooks,
    getCategoryDistribution,
    getPromotionAnalytics,
    getTopRatedBooks,
    getRecentOrders
};