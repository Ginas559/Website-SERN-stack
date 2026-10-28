const { sql, connectDB } = require("../config/connectDB");

const bookColumns = "id, title, author, price, description, image, publication_date, createdAt, updatedAt, isDelete, quantity, discount, purchase_price";
const insertedBookColumns = "INSERTED.id, INSERTED.title, INSERTED.author, INSERTED.price, INSERTED.description, INSERTED.image, INSERTED.publication_date, INSERTED.createdAt, INSERTED.updatedAt, INSERTED.isDelete, INSERTED.quantity, INSERTED.discount, INSERTED.purchase_price";

async function syncBookCategories(transaction, bookId, categoryIds) {
    if (!Array.isArray(categoryIds)) return;

    const cleanIds = [...new Set(categoryIds.map(Number))].filter((id) => id > 0);

    if (cleanIds.length > 0) {
        const checkReq = new sql.Request(transaction);
        const catResult = await checkReq.query(`SELECT id FROM dbo.categories WHERE id IN (${cleanIds.join(",")}) AND isDelete = 0`);
        const existingIds = new Set(catResult.recordset.map((r) => r.id));

        for (const cid of cleanIds) {
            if (!existingIds.has(cid)) {
                const error = new Error(`Thể loại với ID ${cid} không tồn tại hoặc đã bị ẩn.`);
                error.statusCode = 400;
                throw error;
            }
        }
    }

    const delReq = new sql.Request(transaction);
    delReq.input("book_id", sql.Int, bookId);
    await delReq.query("DELETE FROM dbo.book_categories WHERE book_id = @book_id");

    for (const cid of cleanIds) {
        const insReq = new sql.Request(transaction);
        insReq.input("book_id", sql.Int, bookId);
        insReq.input("category_id", sql.Int, cid);
        await insReq.query("INSERT INTO dbo.book_categories (book_id, category_id) VALUES (@book_id, @category_id)");
    }
}

async function create({
    title,
    author,
    price,
    description = null,
    image = null,
    publication_date = null,
    quantity = 0,
    discount = 0,
    purchase_price = 0,
    categoryIds = [],
}) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const bookReq = new sql.Request(transaction);
        const result = await bookReq
            .input("title", sql.NVarChar(255), title)
            .input("author", sql.NVarChar(255), author)
            .input("price", sql.Int, price)
            .input("description", sql.NVarChar(sql.MAX), description)
            .input("image", sql.VarChar(255), image)
            .input("publication_date", sql.DateTime, publication_date)
            .input("quantity", sql.Int, quantity)
            .input("discount", sql.Int, discount)
            .input("purchase_price", sql.Int, purchase_price)
            .query(`INSERT INTO dbo.books 
                    (title, author, price, description, image, publication_date, quantity, discount, purchase_price) 
                    OUTPUT ${insertedBookColumns} 
                    VALUES (@title, @author, @price, @description, @image, @publication_date, @quantity, @discount, @purchase_price)`);

        const createdBook = result.recordset[0];

        if (Array.isArray(categoryIds) && categoryIds.length > 0) {
            await syncBookCategories(transaction, createdBook.id, categoryIds);
        }

        await transaction.commit();
        return createdBook;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function findById(id, { includeDeleted = false } = {}) {
    const pool = await connectDB();
    const condition = includeDeleted ? "WHERE id = @id" : "WHERE id = @id AND isDelete = 0";
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`SELECT TOP 1 ${bookColumns} FROM dbo.books ${condition}`);

    const book = result.recordset[0];
    if (!book) return null;

    const catResult = await pool.request()
        .input("book_id", sql.Int, id)
        .query(`SELECT c.id, c.name, c.description, c.image 
                FROM dbo.categories c 
                INNER JOIN dbo.book_categories bc ON c.id = bc.category_id 
                WHERE bc.book_id = @book_id AND c.isDelete = 0`);
    book.categories = catResult.recordset;
    return book;
}

async function findAll({
    page = 1,
    limit = 10,
    search = "",
    categoryId = null,
    minPrice = null,
    maxPrice = null,
    sort = "newest",
    includeDeleted = false,
} = {}) {
    const pool = await connectDB();
    const request = pool.request();
    const conditions = [];

    if (!includeDeleted) {
        conditions.push("b.isDelete = 0");
    }

    if (search && search.trim()) {
        request.input("search", sql.NVarChar(255), `%${search.trim()}%`);
        conditions.push("(b.title LIKE @search OR b.author LIKE @search)");
    }

    if (categoryId) {
        request.input("categoryId", sql.Int, Number(categoryId));
        conditions.push("b.id IN (SELECT book_id FROM dbo.book_categories WHERE category_id = @categoryId)");
    }

    if (minPrice !== null && minPrice !== undefined) {
        request.input("minPrice", sql.Int, Number(minPrice));
        conditions.push("b.price >= @minPrice");
    }

    if (maxPrice !== null && maxPrice !== undefined) {
        request.input("maxPrice", sql.Int, Number(maxPrice));
        conditions.push("b.price <= @maxPrice");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    let orderBy = "b.id DESC";
    if (sort === "price_asc") orderBy = "b.price ASC";
    else if (sort === "price_desc") orderBy = "b.price DESC";
    else if (sort === "discount") orderBy = "b.discount DESC";

    const countQuery = `SELECT COUNT(DISTINCT b.id) AS total FROM dbo.books b ${whereClause}`;
    const countResult = await request.query(countQuery);
    const total = countResult.recordset[0]?.total || 0;

    const sanitizedPage = Math.max(1, parseInt(page, 10) || 1);
    const sanitizedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (sanitizedPage - 1) * sanitizedLimit;

    request.input("offset", sql.Int, offset);
    request.input("limit", sql.Int, sanitizedLimit);

    const dataQuery = `SELECT ${bookColumns.split(", ").map((col) => `b.${col}`).join(", ")} 
                       FROM dbo.books b 
                       ${whereClause} 
                       ORDER BY ${orderBy} 
                       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`;

    const dataResult = await request.query(dataQuery);
    const books = dataResult.recordset;

    return {
        books,
        total,
        page: sanitizedPage,
        limit: sanitizedLimit,
        totalPages: Math.ceil(total / sanitizedLimit) || 1,
    };
}

async function update(id, fields = {}, categoryIds = null) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const bookReq = new sql.Request(transaction);
        bookReq.input("id", sql.Int, id);

        const setClauses = [];

        if (fields.title !== undefined) {
            bookReq.input("title", sql.NVarChar(255), fields.title);
            setClauses.push("title = @title");
        }
        if (fields.author !== undefined) {
            bookReq.input("author", sql.NVarChar(255), fields.author);
            setClauses.push("author = @author");
        }
        if (fields.price !== undefined) {
            bookReq.input("price", sql.Int, fields.price);
            setClauses.push("price = @price");
        }
        if (fields.description !== undefined) {
            bookReq.input("description", sql.NVarChar(sql.MAX), fields.description);
            setClauses.push("description = @description");
        }
        if (fields.image !== undefined) {
            bookReq.input("image", sql.VarChar(255), fields.image);
            setClauses.push("image = @image");
        }
        if (fields.publication_date !== undefined) {
            bookReq.input("publication_date", sql.DateTime, fields.publication_date);
            setClauses.push("publication_date = @publication_date");
        }
        if (fields.quantity !== undefined) {
            bookReq.input("quantity", sql.Int, fields.quantity);
            setClauses.push("quantity = @quantity");
        }
        if (fields.discount !== undefined) {
            bookReq.input("discount", sql.Int, fields.discount);
            setClauses.push("discount = @discount");
        }
        if (fields.purchase_price !== undefined) {
            bookReq.input("purchase_price", sql.Int, fields.purchase_price);
            setClauses.push("purchase_price = @purchase_price");
        }

        let updatedBook = null;

        if (setClauses.length > 0) {
            setClauses.push("updatedAt = GETDATE()");
            const updateQuery = `UPDATE dbo.books 
                                 SET ${setClauses.join(", ")} 
                                 OUTPUT ${insertedBookColumns} 
                                 WHERE id = @id`;
            const result = await bookReq.query(updateQuery);
            updatedBook = result.recordset[0];
            if (!updatedBook) {
                await transaction.rollback();
                return null;
            }
        } else {
            const checkReq = new sql.Request(transaction);
            checkReq.input("id", sql.Int, id);
            const checkResult = await checkReq.query(`SELECT TOP 1 ${bookColumns} FROM dbo.books WHERE id = @id`);
            updatedBook = checkResult.recordset[0];
            if (!updatedBook) {
                await transaction.rollback();
                return null;
            }
        }

        if (Array.isArray(categoryIds)) {
            await syncBookCategories(transaction, id, categoryIds);
        }

        await transaction.commit();
        return updatedBook;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function softDelete(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`UPDATE dbo.books 
                SET isDelete = 1, updatedAt = GETDATE() 
                OUTPUT ${insertedBookColumns} 
                WHERE id = @id`);
    return result.recordset[0] || null;
}

async function restore(id) {
    const pool = await connectDB();
    const result = await pool.request()
        .input("id", sql.Int, id)
        .query(`UPDATE dbo.books 
                SET isDelete = 0, updatedAt = GETDATE() 
                OUTPUT ${insertedBookColumns} 
                WHERE id = @id`);
    return result.recordset[0] || null;
}

async function setCategories(bookId, categoryIds = []) {
    const pool = await connectDB();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const checkReq = new sql.Request(transaction);
        checkReq.input("id", sql.Int, bookId);
        const checkResult = await checkReq.query("SELECT TOP 1 id FROM dbo.books WHERE id = @id");
        if (!checkResult.recordset[0]) {
            await transaction.rollback();
            return false;
        }

        await syncBookCategories(transaction, bookId, categoryIds);
        await transaction.commit();
        return true;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

module.exports = {
    create,
    findById,
    findAll,
    update,
    softDelete,
    restore,
    setCategories,
};
