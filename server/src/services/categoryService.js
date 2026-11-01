const categoryModel = require("../models/categoryModel");
const AppError = require("../utils/AppError");

const CATEGORY_NAME_INDEX = "UX_categories_active_name";

function isCategoryDuplicateError(error) {
    return (error?.number === 2601 || error?.number === 2627)
        && typeof error.message === "string"
        && error.message.includes(CATEGORY_NAME_INDEX);
}

function handleCategoryWriteError(error) {
    if (isCategoryDuplicateError(error)) {
        throw new AppError("Tên thể loại đã tồn tại.", 409, error);
    }
    throw error;
}

function normalizeOptionalText(value, fieldName) {
    if (value === undefined || value === null) return value;
    if (typeof value !== "string") {
        throw new AppError(`${fieldName} không hợp lệ.`, 400);
    }
    return value.trim();
}

async function createCategory({ name, description, image }) {
    if (typeof name !== "string") {
        throw new AppError("Tên thể loại không hợp lệ.", 400);
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
        throw new AppError("Tên thể loại không được để trống.", 400);
    }

    const existingCategory = await categoryModel.findByName(trimmedName);
    if (existingCategory) {
        throw new AppError("Thể loại đã tồn tại.", 409);
    }

    try {
        return await categoryModel.create({
            name: trimmedName,
            description: normalizeOptionalText(description, "Mô tả thể loại") || null,
            image: normalizeOptionalText(image, "Ảnh thể loại") || null,
        });
    } catch (error) {
        handleCategoryWriteError(error);
    }
}

async function updateCategory(id, { name, description, image }) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw new AppError("Không tìm thấy thể loại.", 404);
    }

    let trimmedName;
    if (name !== undefined) {
        if (typeof name !== "string") {
            throw new AppError("Tên thể loại không hợp lệ.", 400);
        }
        trimmedName = name.trim();
        if (!trimmedName) {
            throw new AppError("Tên thể loại không được để trống.", 400);
        }

        const existingCategory = await categoryModel.findByName(trimmedName);
        if (existingCategory && Number(existingCategory.id) !== Number(id)) {
            throw new AppError("Tên thể loại đã được sử dụng.", 409);
        }
    }

    let updatedCategory;
    try {
        updatedCategory = await categoryModel.update(id, {
            name: trimmedName,
            description: normalizeOptionalText(description, "Mô tả thể loại"),
            image: normalizeOptionalText(image, "Ảnh thể loại"),
        });
    } catch (error) {
        handleCategoryWriteError(error);
    }

    if (!updatedCategory) {
        throw new AppError("Trạng thái thể loại đã thay đổi, vui lòng thử lại.", 409);
    }
    return updatedCategory;
}

async function softDeleteCategory(id) {
    const category = await categoryModel.findById(id);
    if (!category) {
        throw new AppError("Không tìm thấy thể loại.", 404);
    }

    const deletedCategory = await categoryModel.softDelete(id);
    if (!deletedCategory) {
        throw new AppError("Trạng thái thể loại đã thay đổi, vui lòng thử lại.", 409);
    }
    return deletedCategory;
}

async function restoreCategory(id) {
    const category = await categoryModel.findById(id, { includeDeleted: true });
    if (!category) {
        throw new AppError("Không tìm thấy thể loại.", 404);
    }

    let restoredCategory;
    try {
        restoredCategory = await categoryModel.restore(id);
    } catch (error) {
        handleCategoryWriteError(error);
    }

    if (!restoredCategory) {
        throw new AppError("Trạng thái thể loại đã thay đổi, vui lòng thử lại.", 409);
    }
    return restoredCategory;
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
        throw new AppError("Không tìm thấy thể loại.", 404);
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
