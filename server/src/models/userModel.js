const crypto = require("crypto");
const { sql, connectDB } = require("../config/connectDB");

const publicColumns = "id, username, email, phone_number, full_name, address, avatar, isAdmin, createdAt, updatedAt, isDelete, blockReason, isVerified, verificationToken, isVip";
const insertedPublicColumns = "INSERTED.id, INSERTED.username, INSERTED.email, INSERTED.phone_number, INSERTED.full_name, INSERTED.address, INSERTED.avatar, INSERTED.isAdmin, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.isDelete, INSERTED.blockReason, INSERTED.isVerified, INSERTED.verificationToken, INSERTED.isVip";

async function findByEmail(email) {
    const pool = await connectDB();
    const result = await pool.request().input("email", sql.NVarChar(255), email)
        .query(`SELECT TOP 1 ${publicColumns}, [password] FROM dbo.Users WHERE email = @email`);
    return result.recordset[0] || null;
}

async function findById(id) {
    const pool = await connectDB();
    const result = await pool.request()    .input("id", sql.Char(36), id)
    .query(`SELECT TOP 1 ${publicColumns} FROM dbo.Users WHERE id = @id`);
    return result.recordset[0] || null;
}

async function create({ id, username, fullName, email, passwordHash }) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Char(36), id)
        .input("username", sql.VarChar(255), username)
        .input("fullName", sql.VarChar(255), fullName)
        .input("email", sql.VarChar(255), email)
        .input("password", sql.VarChar(255), passwordHash)
        .query(`INSERT INTO dbo.Users (id, username, full_name, email, [password]) OUTPUT ${insertedPublicColumns} VALUES (@id, @username, @fullName, @email, @password)`);
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

async function saveResetToken(email, tokenHash, expiresAt) {
    const pool = await connectDB();
    const result = await pool.request().input("email", sql.VarChar(255), email)
        .input("tokenHash", sql.Char(64), tokenHash).input("expiresAt", sql.DateTime2, expiresAt)
        .query("UPDATE dbo.Users SET verificationToken = @tokenHash, updatedAt = SYSUTCDATETIME() OUTPUT INSERTED.id WHERE email = @email AND isDelete = 0");
    return result.recordset[0] || null;
}

async function resetPassword(tokenHash, passwordHash) {
    const pool = await connectDB();
    const result = await pool.request().input("tokenHash", sql.VarChar(255), tokenHash).input("passwordHash", sql.VarChar(255), passwordHash)
        .query(`UPDATE dbo.Users SET [password] = @passwordHash, verificationToken = NULL, updatedAt = SYSUTCDATETIME() OUTPUT ${insertedPublicColumns} WHERE verificationToken = @tokenHash AND isDelete = 0`);
    return result.recordset[0] || null;
}

function hashResetToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = { findByEmail, findById, create, saveRefreshToken, rotateRefreshToken, revokeRefreshToken, saveResetToken, resetPassword, hashResetToken };
