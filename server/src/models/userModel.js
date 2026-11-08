const crypto = require("crypto");
const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const safeProfileColumns = "id, username, email, phone_number, full_name, address, avatar, isAdmin, isVip, isVerified, createdAt, updatedAt";
const insertedSafeColumns = "INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.phone_number, INSERTED.full_name, INSERTED.address, INSERTED.avatar, INSERTED.isAdmin, INSERTED.isVip, INSERTED.isVerified, INSERTED.createdAt, INSERTED.updatedAt";
const adminUserColumns = "id, username, email, phone_number, full_name, [address], avatar, isAdmin, createdAt, updatedAt, isDelete, blockReason, isVerified, isVip";
const insertedAdminColumns = "INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.phone_number, INSERTED.full_name, INSERTED.[address], INSERTED.avatar, INSERTED.isAdmin, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.isDelete, INSERTED.blockReason, INSERTED.isVerified, INSERTED.isVip";
const publicColumns = "id, username, email, phone_number, full_name, address, avatar, isAdmin, createdAt, updatedAt, isDelete, blockReason, isVerified, verificationToken, isVip";
const insertedPublicColumns = "INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.phone_number, INSERTED.full_name, INSERTED.address, INSERTED.avatar, INSERTED.isAdmin, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.isDelete, INSERTED.blockReason, INSERTED.isVerified, INSERTED.verificationToken, INSERTED.isVip";

async function findByEmail(email) {
    const pool = await connectDB();
    const result = await pool.request().input("email", sql.NVarChar(255), email)
        .query(`SELECT TOP 1 ${publicColumns}, [password] FROM dbo.Users WHERE email = @email`);
    return result.recordset[0] || null;
}

async function findByUsername(username) {
    const pool = await connectDB();
    const result = await pool.request().input("username", sql.VarChar(255), username)
        .query(`SELECT TOP 1 ${publicColumns} FROM dbo.Users WHERE username = @username`);
    return result.recordset[0] || null;
}

async function findById(id) {
    const pool = await connectDB();
    const result = await pool.request()    .input("id", sql.Char(36), id)
    .query(`SELECT TOP 1 ${publicColumns} FROM dbo.Users WHERE id = @id`);
    return result.recordset[0] || null;
}

async function findPasswordById(id) {
    const pool = await connectDB();
    const result = await pool.request().input("id", sql.Char(36), id)
        .query("SELECT TOP 1 id, [password] FROM dbo.Users WHERE id = @id AND isDelete = 0");
    return result.recordset[0] || null;
}

async function create({ id, username, fullName, email, phone, address, passwordHash }) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .input("username", sql.VarChar(255), username)
        .input("fullName", sql.VarChar(255), fullName)
        .input("email", sql.VarChar(255), email)
        .input("phone", sql.VarChar(255), phone)
        .input("address", sql.VarChar(255), address)
        .input("password", sql.VarChar(255), passwordHash)
        .query(`INSERT INTO dbo.Users (id, username, full_name, email, phone_number, [address], [password]) OUTPUT ${insertedPublicColumns} VALUES (@id, @username, @fullName, @email, @phone, @address, @password)`);
    return result.recordset[0];
}

async function saveRefreshToken(userId, tokenId, expiresAt) {
    const pool = await connectDB();
    await pool.request()    .input("userId", sql.Char(36), userId).input("tokenId", sql.VarChar(36), tokenId)
        .input("expiresAt", sql.DateTime2, expiresAt)
        .query("INSERT INTO dbo.RefreshTokens (UserId, TokenId, ExpiresAt) VALUES (@userId, @tokenId, @expiresAt)");
}

async function rotateRefreshToken(tokenId, newTokenId, expiresAt) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const request = new sql.Request(transaction);
        const result = await request.input("tokenId", sql.VarChar(36), tokenId)
            .query("UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() OUTPUT INSERTED.UserId WHERE TokenId = @tokenId AND RevokedAt IS NULL AND ExpiresAt > SYSUTCDATETIME()");
        if (!result.recordset[0]) {
            await transaction.rollback();
            return null;
        }
        await new sql.Request(transaction).input("userId", sql.Char(36), result.recordset[0].UserId)
            .input("newTokenId", sql.VarChar(36), newTokenId).input("expiresAt", sql.DateTime2, expiresAt)
            .query("INSERT INTO dbo.RefreshTokens (UserId, TokenId, ExpiresAt) VALUES (@userId, @newTokenId, @expiresAt)");
        await transaction.commit();
        return result.recordset[0].UserId;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function revokeRefreshToken(tokenId) {
    const pool = await connectDB();
    await pool.request().input("tokenId", sql.VarChar(36), tokenId)
        .query("UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() WHERE TokenId = @tokenId AND RevokedAt IS NULL");
}

async function revokeUserRefreshTokens(userId) {
    const pool = await connectDB();
    await pool.request().input("userId", sql.Char(36), userId)
        .query("UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() WHERE UserId = @userId AND RevokedAt IS NULL");
}

async function saveResetToken(email, tokenHash, expiresAt) {
    const pool = await connectDB();
    const result = await pool.request().input("email", sql.VarChar(255), email)
        .input("tokenHash", sql.Char(64), tokenHash).input("expiresAt", sql.DateTime2, expiresAt)
        .query("UPDATE dbo.Users SET verificationToken = @tokenHash, resetPasswordExpiresAt = @expiresAt, resetPasswordUsedAt = NULL, updatedAt = SYSUTCDATETIME() OUTPUT INSERTED.id WHERE email = @email AND isDelete = 0");
    return result.recordset[0] || null;
}

async function resetPassword(tokenHash, passwordHash) {
    const pool = await connectDB();
    const result = await pool.request().input("tokenHash", sql.VarChar(255), tokenHash).input("passwordHash", sql.VarChar(255), passwordHash)
        .query(`UPDATE dbo.Users SET [password] = @passwordHash, verificationToken = NULL, resetPasswordExpiresAt = NULL, resetPasswordUsedAt = SYSUTCDATETIME(), updatedAt = SYSUTCDATETIME() OUTPUT ${insertedPublicColumns} WHERE verificationToken = @tokenHash AND resetPasswordExpiresAt > SYSUTCDATETIME() AND resetPasswordUsedAt IS NULL AND isDelete = 0`);
    return result.recordset[0] || null;
}

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function changePassword(userId, currentPasswordHash, passwordHash) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
        const userResult = await new sql.Request(transaction)
            .input("userId", sql.Char(36), userId)
            .query("SELECT TOP 1 [password] FROM dbo.Users WHERE id = @userId AND isDelete = 0");
        const user = userResult.recordset[0];
        if (!user) {
            await transaction.rollback();
            return null;
        }
        const result = await new sql.Request(transaction)
            .input("userId", sql.Char(36), userId)
            .input("currentPasswordHash", sql.VarChar(255), currentPasswordHash)
            .input("passwordHash", sql.VarChar(255), passwordHash)
            .query("UPDATE dbo.Users SET [password] = @passwordHash, updatedAt = SYSUTCDATETIME() WHERE id = @userId AND [password] = @currentPasswordHash AND isDelete = 0");
        if (!result.rowsAffected[0]) {
            await transaction.rollback();
            return null;
        }
        await new sql.Request(transaction)
            .input("userId", sql.Char(36), userId)
            .query("UPDATE dbo.RefreshTokens SET RevokedAt = SYSUTCDATETIME() WHERE UserId = @userId AND RevokedAt IS NULL");
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}


function handleUserWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Thông tin người dùng (email hoặc số điện thoại) đã tồn tại trong hệ thống.", 409, error);
    }
    throw error;
}

async function findByIdSafe(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query(`SELECT TOP 1 ${safeProfileColumns} FROM dbo.Users WHERE id = @id AND isDelete = 0`);
    return result.recordset[0] || null;
}

async function findStatusById(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query("SELECT TOP 1 id, isDelete, blockReason, isVerified, isVip FROM dbo.Users WHERE id = @id");
    return result.recordset[0] || null;
}

async function updateProfile(id, { fullName, phoneNumber, address, avatar } = {}) {
    const pool = await connectDB();
    const req = pool.request().input("id", sql.Char(36), id);
    const updates = ["updatedAt = GETDATE()"];

    if (fullName !== undefined) {
        updates.push("full_name = @fullName");
        req.input("fullName", sql.NVarChar(255), fullName ? String(fullName).trim() : null);
    }
    if (phoneNumber !== undefined) {
        updates.push("phone_number = @phoneNumber");
        req.input("phoneNumber", sql.VarChar(255), phoneNumber ? String(phoneNumber).trim() : null);
    }
    if (address !== undefined) {
        updates.push("[address] = @address");
        req.input("address", sql.NVarChar(255), address ? String(address).trim() : null);
    }
    if (avatar !== undefined) {
        updates.push("avatar = @avatar");
        req.input("avatar", sql.VarChar(255), avatar ? String(avatar).trim() : null);
    }

    try {
        const result = await req.query(`UPDATE dbo.Users
                                        SET ${updates.join(", ")}
                                        OUTPUT ${insertedSafeColumns}
                                        WHERE id = @id AND isDelete = 0`);
        return result.recordset[0] || null;
    } catch (error) {
        handleUserWriteError(error);
    }
}

async function findAllForAdmin({
    page = 1,
    limit = 10,
    search,
    isDelete,
    isAdmin,
    isVerified,
    isVip,
    sortBy = "createdAt",
    sortOrder = "DESC"
} = {}) {
    const pool = await connectDB();
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    const whereClauses = [];
    const countReq = pool.request();
    const listReq = pool.request();

    if (isDelete !== null && isDelete !== undefined) {
        whereClauses.push("isDelete = @isDelete");
        countReq.input("isDelete", sql.TinyInt, Number(isDelete));
        listReq.input("isDelete", sql.TinyInt, Number(isDelete));
    }

    if (isAdmin !== null && isAdmin !== undefined) {
        whereClauses.push("isAdmin = @isAdmin");
        countReq.input("isAdmin", sql.TinyInt, Number(isAdmin));
        listReq.input("isAdmin", sql.TinyInt, Number(isAdmin));
    }

    if (isVerified !== null && isVerified !== undefined) {
        whereClauses.push("isVerified = @isVerified");
        countReq.input("isVerified", sql.TinyInt, Number(isVerified));
        listReq.input("isVerified", sql.TinyInt, Number(isVerified));
    }

    if (isVip !== null && isVip !== undefined) {
        whereClauses.push("isVip = @isVip");
        countReq.input("isVip", sql.TinyInt, Number(isVip));
        listReq.input("isVip", sql.TinyInt, Number(isVip));
    }

    if (search && typeof search === "string" && search.trim()) {
        const cleanSearch = `%${search.trim()}%`;
        whereClauses.push("(username LIKE @search OR email LIKE @search OR full_name LIKE @search OR phone_number LIKE @search)");
        countReq.input("search", sql.NVarChar(255), cleanSearch);
        listReq.input("search", sql.NVarChar(255), cleanSearch);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countRes = await countReq.query(`SELECT COUNT(*) AS total FROM dbo.Users ${whereSql}`);
    const total = countRes.recordset[0].total;

    const allowedSortColumns = {
        createdAt: "createdAt",
        updatedAt: "updatedAt",
        username: "username",
        email: "email",
        full_name: "full_name",
        phone_number: "phone_number"
    };
    const sortColumn = allowedSortColumns[sortBy] || "createdAt";
    const direction = String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    listReq.input("offset", sql.Int, offset);
    listReq.input("limit", sql.Int, safeLimit);

    const listRes = await listReq.query(`SELECT ${adminUserColumns}
                                         FROM dbo.Users
                                         ${whereSql}
                                         ORDER BY ${sortColumn} ${direction}, id DESC
                                         OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);

    return {
        users: listRes.recordset,
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit) || 1
    };
}

async function findByIdAdmin(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query(`SELECT TOP 1 ${adminUserColumns} FROM dbo.Users WHERE id = @id`);
    return result.recordset[0] || null;
}

async function block(id, blockReason = null) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .input("blockReason", sql.NVarChar(255), blockReason ? String(blockReason).trim() : null)
        .query(`UPDATE dbo.Users
                SET isDelete = 1, blockReason = @blockReason, updatedAt = GETDATE()
                OUTPUT ${insertedAdminColumns}
                WHERE id = @id AND isDelete = 0`);
    return result.recordset[0] || null;
}

async function restore(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .query(`UPDATE dbo.Users
                SET isDelete = 0, blockReason = NULL, updatedAt = GETDATE()
                OUTPUT ${insertedAdminColumns}
                WHERE id = @id AND isDelete = 1`);
    return result.recordset[0] || null;
}

async function changeStatus(id, { isDelete, blockReason = null } = {}) {
    if (Number(isDelete) === 1) {
        return block(id, blockReason);
    }
    return restore(id);
}

module.exports = {
    findByEmail,
    findByUsername,
    findById,
    findPasswordById,
    create,
    saveRefreshToken,
    rotateRefreshToken,
    revokeRefreshToken,
    revokeUserRefreshTokens,
    saveResetToken,
    resetPassword,
    changePassword,
    hashResetToken,
    findByIdSafe,
    findStatusById,
    updateProfile,
    handleUserWriteError,
    findAllForAdmin,
    findByIdAdmin,
    block,
    restore,
    changeStatus
};
