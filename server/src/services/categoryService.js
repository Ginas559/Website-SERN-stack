const categoryModel = require("../models/categoryModel");

function createError(message, statusCode) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

async function createCategory({ name, description, image }) {
    const trimmedName = name ? name.trim() : "";
    if (!trimmedName) {
        throw createError("Tên thể loại không được để trống.", 400);
    }

    const existingCategory = await categoryModel.findByName(trimmedName);
    if (existingCategory) {
        throw createError("Thể loại đã tồn tại.", 400);
    }

    return await categoryModel.create({
        name: trimmedName,
        description: description ? description.trim() : null,
        image: image || null,
    });
}

async function updateCategory(id, { name, description, image }) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw createError("Không tìm thấy thể loại.", 404);
    }

    let trimmedName;
    if (name !== undefined) {
        trimmedName = name ? name.trim() : "";
        if (!trimmedName) {
            throw createError("Tên thể loại không được để trống.", 400);
        }

        const existingCategory = await categoryModel.findByName(trimmedName);
        if (existingCategory && Number(existingCategory.id) !== Number(id)) {
            throw createError("Tên thể loại đã được sử dụng.", 400);
        }
    }

    return await categoryModel.update(id, {
        name: trimmedName,
        description: description !== undefined ? (description ? description.trim() : null) : undefined,
        image: image !== undefined ? image : undefined,
    });
}

async function softDeleteCategory(id) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw createError("Không tìm thấy thể loại.", 404);
    }

    return await categoryModel.softDelete(id);
}

async function restoreCategory(id) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw createError("Không tìm thấy thể loại.", 404);
    }

    return await categoryModel.restore(id);
}

async function getAdminCategories() {
    const categories = await categoryModel.findAll({ includeDeleted: true });
    return await Promise.all(
        categories.map(async (cat) => {
            const bookCount = await categoryModel.countBooks(cat.id);
            return {
                ...cat,
                bookCount,
            };
        })
    );
}

async function getCategoryById(id) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw createError("Không tìm thấy thể loại.", 404);
    }
    const bookCount = await categoryModel.countBooks(id);
    return {
        ...category,
        bookCount,
    };
}

module.exports = {
    createCategory,
    updateCategory,
    softDeleteCategory,
    restoreCategory,
    getAdminCategories,
    getCategoryById,
};
