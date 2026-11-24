const { sql, connectDB } = require("../config/connectDB");
const AppError = require("../utils/AppError");

const policyColumns = "id, policy_key, policy_value, value_type, description, updated_by, createdAt, updatedAt";

function handlePolicyWriteError(error) {
    if (error && (error.number === 2601 || error.number === 2627)) {
        throw new AppError("Khóa chính sách cửa hàng đã tồn tại.", 409, error);
    }
    if (error && error.number === 547) {
        throw new AppError("Dữ liệu liên kết chính sách cửa hàng không hợp lệ.", 400, error);
    }
    throw error;
}

async function findByKeys(keys = [], transaction = null) {
    const cleanKeys = [...new Set(
        (Array.isArray(keys) ? keys : [])
            .map((key) => String(key || "").trim())
            .filter(Boolean)
    )];

    if (cleanKeys.length === 0) {
        return [];
    }

    const executor = transaction || await connectDB();
    const request = new sql.Request(executor);
    const paramNames = cleanKeys.map((key, index) => {
        const paramName = `key_${index}`;
        request.input(paramName, sql.VarChar(100), key);
        return `@${paramName}`;
    });

    const result = await request.query(`
        SELECT ${policyColumns}
        FROM dbo.store_policies
        WHERE policy_key IN (${paramNames.join(", ")})
        ORDER BY policy_key ASC
    `);

    return result.recordset;
}

async function findAll(transaction = null) {
    const executor = transaction || await connectDB();
    const request = new sql.Request(executor);
    const result = await request.query(`
        SELECT ${policyColumns}
        FROM dbo.store_policies
        ORDER BY policy_key ASC
    `);
    return result.recordset;
}

async function upsertPolicies(entries = [], updatedBy = null, expectedUpdatedAt = null) {
    if (!Array.isArray(entries) || entries.length === 0) {
        return [];
    }

    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        if (expectedUpdatedAt) {
            const keys = entries.map((entry) => entry.policyKey);
            const currentRows = await findByKeys(keys, transaction);
            let latestTime = 0;
            for (const row of currentRows) {
                if (row.updatedAt) {
                    const ts = new Date(row.updatedAt).getTime();
                    if (Number.isFinite(ts) && ts > latestTime) {
                        latestTime = ts;
                    }
                }
            }
            const expectedTime = new Date(expectedUpdatedAt).getTime();
            if (!Number.isFinite(expectedTime) || (latestTime > 0 && latestTime !== expectedTime)) {
                throw new AppError("Chính sách cửa hàng đã được quản trị viên khác cập nhật trước đó, vui lòng tải lại trước khi lưu.", 409);
            }
        }

        const updatedRows = [];
        for (const entry of entries) {
            const updateRequest = new sql.Request(transaction);
            updateRequest
                .input("policy_key", sql.VarChar(100), entry.policyKey)
                .input("policy_value", sql.NVarChar(255), String(entry.policyValue))
                .input("value_type", sql.VarChar(20), entry.valueType || "INT")
                .input("description", sql.NVarChar(255), entry.description || null)
                .input("updated_by", sql.Char(36), updatedBy || null);

            const updateResult = await updateRequest.query(`
                UPDATE dbo.store_policies WITH (UPDLOCK, HOLDLOCK)
                SET policy_value = @policy_value,
                    value_type = @value_type,
                    description = COALESCE(@description, description),
                    updated_by = @updated_by,
                    updatedAt = SYSUTCDATETIME()
                OUTPUT ${policyColumns.split(", ").map((col) => `INSERTED.${col}`).join(", ")}
                WHERE policy_key = @policy_key
            `);

            if (updateResult.recordset.length > 0) {
                updatedRows.push(updateResult.recordset[0]);
                continue;
            }

            const insertRequest = new sql.Request(transaction);
            insertRequest
                .input("policy_key", sql.VarChar(100), entry.policyKey)
                .input("policy_value", sql.NVarChar(255), String(entry.policyValue))
                .input("value_type", sql.VarChar(20), entry.valueType || "INT")
                .input("description", sql.NVarChar(255), entry.description || null)
                .input("updated_by", sql.Char(36), updatedBy || null);

            const insertResult = await insertRequest.query(`
                INSERT INTO dbo.store_policies (policy_key, policy_value, value_type, description, updated_by, createdAt, updatedAt)
                OUTPUT ${policyColumns.split(", ").map((col) => `INSERTED.${col}`).join(", ")}
                VALUES (@policy_key, @policy_value, @value_type, @description, @updated_by, SYSUTCDATETIME(), SYSUTCDATETIME())
            `);

            if (insertResult.recordset.length > 0) {
                updatedRows.push(insertResult.recordset[0]);
            }
        }

        await transaction.commit();
        return updatedRows;
    } catch (error) {
        try {
            await transaction.rollback();
        } catch {
            return handlePolicyWriteError(error);
        }
        handlePolicyWriteError(error);
    }
}

module.exports = {
    findByKeys,
    findAll,
    upsertPolicies,
    handlePolicyWriteError
};

