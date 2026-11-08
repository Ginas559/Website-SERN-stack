const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const discountColumns = "id, code, discount_type, value, maxDiscountValue, minimumOrderValue, description, quantity, usedCount, startDate, expiredAt, isDelete, createdAt, updatedAt";
const insertedColumns = "INSERTED.id, INSERTED.code, INSERTED.discount_type, INSERTED.value, INSERTED.maxDiscountValue, INSERTED.minimumOrderValue, INSERTED.description, INSERTED.quantity, INSERTED.usedCount, INSERTED.startDate, INSERTED.expiredAt, INSERTED.isDelete, INSERTED.createdAt, INSERTED.updatedAt";

function handleDiscountWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Mã khuyến mãi này đã tồn tại và đang hoạt động.", 409, error);
    }
    throw error;
}

async function create(discountData, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const result = await new sql.Request(executor)
            .input("code", sql.VarChar(50), discountData.code.trim().toUpperCase())
            .input("discount_type", sql.VarChar(20), discountData.discount_type || "PERCENT")
            .input("value", sql.Int, Number(discountData.value))
            .input("maxDiscountValue", sql.Int, discountData.maxDiscountValue !== undefined && discountData.maxDiscountValue !== null ? Number(discountData.maxDiscountValue) : null)
            .input("minimumOrderValue", sql.Int, Math.max(0, Number(discountData.minimumOrderValue) || 0))
            .input("description", sql.NVarChar(255), discountData.description ? discountData.description.trim() : null)
            .input("quantity", sql.Int, Math.max(1, Number(discountData.quantity) || 100))
            .input("usedCount", sql.Int, 0)
            .input("startDate", sql.DateTime, discountData.startDate ? new Date(discountData.startDate) : new Date())
            .input("expiredAt", sql.DateTime, discountData.expiredAt ? new Date(discountData.expiredAt) : null)
            .query(`INSERT INTO dbo.discounts (code, discount_type, value, maxDiscountValue, minimumOrderValue, description, quantity, usedCount, startDate, expiredAt, isDelete, createdAt, updatedAt)
                    OUTPUT ${insertedColumns}
                    VALUES (@code, @discount_type, @value, @maxDiscountValue, @minimumOrderValue, @description, @quantity, @usedCount, @startDate, @expiredAt, 0, GETDATE(), GETDATE())`);

        return result.recordset[0];
    } catch (error) {
        handleDiscountWriteError(error);
    }
}

async function findById(id, { includeDeleted = false } = {}, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    let whereSql = "WHERE id = @id";
    if (!includeDeleted) {
        whereSql += " AND isDelete = 0";
    }

    const result = await new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .query(`SELECT ${discountColumns} FROM dbo.discounts ${whereSql}`);

    return result.recordset[0] || null;
}

async function findByCode(code, { includeDeleted = false } = {}, transaction = null) {
    if (!code || typeof code !== "string") return null;
    const pool = await connectDB();
    const executor = transaction || pool;

    let whereSql = "WHERE UPPER(code) = @code";
    if (!includeDeleted) {
        whereSql += " AND isDelete = 0";
    }

    const result = await new sql.Request(executor)
        .input("code", sql.VarChar(50), code.trim().toUpperCase())
        .query(`SELECT ${discountColumns} FROM dbo.discounts ${whereSql}`);

    return result.recordset[0] || null;
}

async function findAll({ page = 1, limit = 10, search = "", isDelete = null, status = "all" } = {}, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    const whereClauses = [];
    const countReq = new sql.Request(executor);
    const listReq = new sql.Request(executor);

    if (isDelete !== null && isDelete !== undefined) {
        whereClauses.push("isDelete = @isDelete");
        countReq.input("isDelete", sql.TinyInt, Number(isDelete));
        listReq.input("isDelete", sql.TinyInt, Number(isDelete));
    }

    if (search && typeof search === "string" && search.trim()) {
        const cleanSearch = `%${search.trim()}%`;
        whereClauses.push("(code LIKE @search OR description LIKE @search)");
        countReq.input("search", sql.NVarChar(255), cleanSearch);
        listReq.input("search", sql.NVarChar(255), cleanSearch);
    }

    if (status === "active") {
        whereClauses.push("isDelete = 0 AND (expiredAt IS NULL OR expiredAt > GETDATE()) AND usedCount < quantity");
    } else if (status === "expired") {
        whereClauses.push("isDelete = 0 AND (expiredAt IS NOT NULL AND expiredAt <= GETDATE())");
    } else if (status === "exhausted") {
        whereClauses.push("isDelete = 0 AND usedCount >= quantity");
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.discounts ${whereSql}`);
    const total = countRes.recordset[0].total;

    listReq.input("offset", sql.Int, offset);
    listReq.input("limit", sql.Int, safeLimit);

    const listRes = await listReq.query(`SELECT ${discountColumns}
                                         FROM dbo.discounts
                                         ${whereSql}
                                         ORDER BY createdAt DESC
                                         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return {
        discounts: listRes.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1
    };
}

async function update(id, discountData, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const req = new sql.Request(executor).input("id", sql.Int, Number(id));

        const updates = [];
        if (discountData.code !== undefined) {
            updates.push("code = @code");
            req.input("code", sql.VarChar(50), discountData.code.trim().toUpperCase());
        }
        if (discountData.discount_type !== undefined) {
            updates.push("discount_type = @discount_type");
            req.input("discount_type", sql.VarChar(20), discountData.discount_type);
        }
        if (discountData.value !== undefined) {
            updates.push("value = @value");
            req.input("value", sql.Int, Number(discountData.value));
        }
        if (discountData.maxDiscountValue !== undefined) {
            updates.push("maxDiscountValue = @maxDiscountValue");
            req.input("maxDiscountValue", sql.Int, discountData.maxDiscountValue !== null ? Number(discountData.maxDiscountValue) : null);
        }
        if (discountData.minimumOrderValue !== undefined) {
            updates.push("minimumOrderValue = @minimumOrderValue");
            req.input("minimumOrderValue", sql.Int, Math.max(0, Number(discountData.minimumOrderValue)));
        }
        if (discountData.description !== undefined) {
            updates.push("description = @description");
            req.input("description", sql.NVarChar(255), discountData.description ? discountData.description.trim() : null);
        }
        if (discountData.quantity !== undefined) {
            updates.push("quantity = @quantity");
            req.input("quantity", sql.Int, Math.max(1, Number(discountData.quantity)));
        }
        if (discountData.startDate !== undefined) {
            updates.push("startDate = @startDate");
            req.input("startDate", sql.DateTime, discountData.startDate ? new Date(discountData.startDate) : new Date());
        }
        if (discountData.expiredAt !== undefined) {
            updates.push("expiredAt = @expiredAt");
            req.input("expiredAt", sql.DateTime, discountData.expiredAt ? new Date(discountData.expiredAt) : null);
        }

        updates.push("updatedAt = GETDATE()");

        const result = await req.query(`UPDATE dbo.discounts
                                        SET ${updates.join(", ")}
                                        OUTPUT ${insertedColumns}
                                        WHERE id = @id AND isDelete = 0`);

        return result.recordset[0] || null;
    } catch (error) {
        handleDiscountWriteError(error);
    }
}

async function softDelete(id, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const result = await new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .query(`UPDATE dbo.discounts
                SET isDelete = 1, updatedAt = GETDATE()
                OUTPUT ${insertedColumns}
                WHERE id = @id AND isDelete = 0`);

    return result.recordset[0] || null;
}

async function restore(id, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    try {
        const result = await new sql.Request(executor)
            .input("id", sql.Int, Number(id))
            .query(`UPDATE dbo.discounts
                    SET isDelete = 0, updatedAt = GETDATE()
                    OUTPUT ${insertedColumns}
                    WHERE id = @id AND isDelete = 1`);

        return result.recordset[0] || null;
    } catch (error) {
        handleDiscountWriteError(error);
    }
}

async function incrementUsedCount(id, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const result = await new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .query(`UPDATE dbo.discounts
                SET usedCount = usedCount + 1, updatedAt = GETDATE()
                OUTPUT ${insertedColumns}
                WHERE id = @id AND isDelete = 0 AND usedCount < quantity`);

    return result.recordset[0] || null;
}

async function decrementUsedCount(id, transaction = null) {
    const pool = await connectDB();
    const executor = transaction || pool;

    const result = await new sql.Request(executor)
        .input("id", sql.Int, Number(id))
        .query(`UPDATE dbo.discounts
                SET usedCount = CASE WHEN usedCount > 0 THEN usedCount - 1 ELSE 0 END, updatedAt = GETDATE()
                OUTPUT ${insertedColumns}
                WHERE id = @id AND isDelete = 0`);

    return result.recordset[0] || null;
}

module.exports = {
    create,
    findById,
    findByCode,
    findAll,
    update,
    softDelete,
    restore,
    incrementUsedCount,
    decrementUsedCount,
    handleDiscountWriteError
};

