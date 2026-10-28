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

async function findById(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`SELECT TOP 1 ${categoryColumns} FROM dbo.categories WHERE id = @id`);
    return result.recordset[0] || null;
}

async function findByName(name) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("name", sql.VarChar(255), name)
        .query(`SELECT TOP 1 ${categoryColumns} FROM dbo.categories WHERE name = @name`);
    return result.recordset[0] || null;
}

async function create({ name, description = null, image = null }) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("name", sql.VarChar(255), name)
        .input("description", sql.VarChar(255), description)
        .input("image", sql.VarChar(255), image)
        .query(`INSERT INTO dbo.categories (name, description, image) OUTPUT ${insertedCategoryColumns} VALUES (@name, @description, @image)`);
    return result.recordset[0];
}

async function update(id, { name, description, image }) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .input("name", sql.VarChar(255), name)
        .input("description", sql.VarChar(255), description)
        .input("image", sql.VarChar(255), image)
        .query(`UPDATE dbo.categories 
                SET name = COALESCE(@name, name), 
                    description = COALESCE(@description, description), 
                    image = COALESCE(@image, image), 
                    updatedAt = GETDATE() 
                OUTPUT ${insertedCategoryColumns} 
                WHERE id = @id`);
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
