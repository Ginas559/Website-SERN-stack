const { sql, connectDB } = require("../config/connectDB");

const categoryColumns = "id, name, description, image, createdAt, updatedAt, isDelete";
const insertedCategoryColumns = "INSERTED.id, INSERTED.name, INSERTED.description, INSERTED.image, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.isDelete";

async function findAll({ includeDeleted = false } = {}) {
    const pool = await connectDB();
    const query = includeDeleted
        ? `SELECT ${categoryColumns} FROM dbo.categories ORDER BY id DESC`
        : `SELECT ${categoryColumns} FROM dbo.categories WHERE isDelete = 0 ORDER BY id DESC`;
    const result = await pool.request().query(query);
    return result.recordset;
}

async function findById(id, { includeDeleted = false } = {}) {
    const pool = await connectDB();
    const condition = includeDeleted ? "WHERE id = @id" : "WHERE id = @id AND isDelete = 0";
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`SELECT TOP 1 ${categoryColumns} FROM dbo.categories ${condition}`);
    return result.recordset[0] || null;
}

async function findByName(name, { includeDeleted = false } = {}) {
    const pool = await connectDB();
    const condition = includeDeleted ? "WHERE name = @name" : "WHERE name = @name AND isDelete = 0";
    const result = await pool.request()
        .input("name", sql.NVarChar(255), name)
        .query(`SELECT TOP 1 ${categoryColumns} FROM dbo.categories ${condition}`);
    return result.recordset[0] || null;
}

async function create({ name, description = null, image = null }) {
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
        const error = new Error("Tên thể loại không được để trống.");
        error.statusCode = 400;
        throw error;
    }

    const existingCategory = await findByName(trimmedName, { includeDeleted: false });
    if (existingCategory) {
        const error = new Error("Tên thể loại đã tồn tại.");
        error.statusCode = 400;
        throw error;
    }

    const pool = await connectDB();
    const result = await pool.request()
        .input("name", sql.NVarChar(255), trimmedName)
        .input("description", sql.NVarChar(sql.MAX), description)
        .input("image", sql.VarChar(255), image)
        .query(`INSERT INTO dbo.categories (name, description, image) OUTPUT ${insertedCategoryColumns} VALUES (@name, @description, @image)`);
    return result.recordset[0];
}

async function update(id, fields = {}) {
    const pool = await connectDB();

    if (fields.name !== undefined) {
        const trimmedName = typeof fields.name === "string" ? fields.name.trim() : "";
        if (!trimmedName) {
            const error = new Error("Tên thể loại không được để trống.");
            error.statusCode = 400;
            throw error;
        }

        const duplicateCheck = await pool.request()
            .input("name", sql.NVarChar(255), trimmedName)
            .input("id", sql.Int, id)
            .query("SELECT TOP 1 id FROM dbo.categories WHERE name = @name AND id != @id AND isDelete = 0");

        if (duplicateCheck.recordset[0]) {
            const error = new Error("Tên thể loại đã tồn tại.");
            error.statusCode = 400;
            throw error;
        }
        fields.name = trimmedName;
    }

    const request = pool.request();
    request.input("id", sql.Int, id);

    const setClauses = [];

    if (fields.name !== undefined) {
        request.input("name", sql.NVarChar(255), fields.name);
        setClauses.push("name = @name");
    }
    if (fields.description !== undefined) {
        request.input("description", sql.NVarChar(sql.MAX), fields.description);
        setClauses.push("description = @description");
    }
    if (fields.image !== undefined) {
        request.input("image", sql.VarChar(255), fields.image);
        setClauses.push("image = @image");
    }

    if (setClauses.length === 0) {
        return await findById(id, { includeDeleted: true });
    }

    setClauses.push("updatedAt = GETDATE()");

    const query = `UPDATE dbo.categories 
                   SET ${setClauses.join(", ")} 
                   OUTPUT ${insertedCategoryColumns} 
                   WHERE id = @id`;
    const result = await request.query(query);
    return result.recordset[0] || null;
}

async function softDelete(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`UPDATE dbo.categories 
                SET isDelete = 1, updatedAt = GETDATE() 
                OUTPUT ${insertedCategoryColumns} 
                WHERE id = @id`);
    return result.recordset[0] || null;
}

async function restore(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`UPDATE dbo.categories 
                SET isDelete = 0, updatedAt = GETDATE() 
                OUTPUT ${insertedCategoryColumns} 
                WHERE id = @id`);
    return result.recordset[0] || null;
}

async function countBooks(categoryId) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("categoryId", sql.Int, categoryId)
        .query(`SELECT COUNT(*) AS total 
                FROM dbo.book_categories bc
                INNER JOIN dbo.books b ON bc.book_id = b.id
                WHERE bc.category_id = @categoryId AND b.isDelete = 0`);
    return result.recordset[0]?.total || 0;
}

module.exports = {
    findAll,
    findById,
    findByName,
    create,
    update,
    softDelete,
    restore,
    countBooks,
};
