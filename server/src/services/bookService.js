const bookModel = require("../models/bookModel");
const AppError = require("../utils/AppError");

function validateBookId(id) {
    const bookId = Number(id);
    if (!Number.isInteger(bookId) || bookId <= 0) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    return bookId;
}

function validateNumber(value, field, { min, max } = {}) {
    if (value === null || value === undefined || (typeof value === "string" && !value.trim())) {
        throw new AppError(field, 400);
    }
    const number = Number(value);
    if (!Number.isInteger(number) || (min !== undefined && number < min) || (max !== undefined && number > max)) {
        throw new AppError(field, 400);
    }
    return number;
}

function validatePublicationDate(value) {
    if (value === null || value === undefined) return null;
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;
    if (typeof value !== "string" || !isoDatePattern.test(value) || Number.isNaN(Date.parse(value))) {
        throw new AppError("Ngày xuất bản không hợp lệ.", 400);
    }
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    const normalizedDate = new Date(Date.UTC(year, month - 1, day));
    if (normalizedDate.getUTCFullYear() !== year || normalizedDate.getUTCMonth() !== month - 1 || normalizedDate.getUTCDate() !== day) {
        throw new AppError("Ngày xuất bản không hợp lệ.", 400);
    }
    return value;
}

function validateOptionalText(value, field, maxLength) {
    if (value === null || value === undefined) {
        return null;
    }
    if (typeof value !== "string") {
        throw new AppError(field, 400);
    }
    const normalizedValue = value.trim();
    if (normalizedValue.length > maxLength) {
        throw new AppError(field, 400);
    }
    return normalizedValue;
}

function validateRequiredText(value, emptyMessage, lengthMessage) {
    if (typeof value !== "string") {
        throw new AppError(emptyMessage, 400);
    }
    const normalizedValue = value.trim();
    if (!normalizedValue) {
        throw new AppError(emptyMessage, 400);
    }
    if (normalizedValue.length > 255) {
        throw new AppError(lengthMessage, 400);
    }
    return normalizedValue;
}

function validateCategoryIds(categoryIds) {
    if (!Array.isArray(categoryIds)) {
        throw new AppError("Danh sách thể loại phải là mảng ID.", 400);
    }
    const normalizedIds = categoryIds.map((id) => validateNumber(id, "Mỗi ID thể loại phải là số nguyên dương.", { min: 1 }));
    return [...new Set(normalizedIds)];
}

async function createBook({
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
    const normalizedTitle = validateRequiredText(title, "Tiêu đề sách không được để trống.", "Tiêu đề sách không được vượt quá 255 ký tự.");
    const normalizedAuthor = validateRequiredText(author, "Tên tác giả không được để trống.", "Tên tác giả không được vượt quá 255 ký tự.");
    const normalizedCategoryIds = validateCategoryIds(categoryIds);
    const normalizedDescription = validateOptionalText(description, "Mô tả sách không hợp lệ.", 4000);
    const normalizedImage = validateOptionalText(image, "Ảnh sách không hợp lệ.", 255);
    const normalizedPrice = validateNumber(price, "Giá bán sách phải lớn hơn 0.", { min: 1 });
    const normalizedQuantity = validateNumber(quantity, "Số lượng tồn kho không được nhỏ hơn 0.", { min: 0 });
    const normalizedDiscount = validateNumber(discount, "Tỉ lệ giảm giá phải từ 0% đến 100%.", { min: 0, max: 100 });
    const normalizedPurchasePrice = validateNumber(purchase_price, "Giá nhập kho không được nhỏ hơn 0.", { min: 0 });

    const createdBook = await bookModel.create({
        title: normalizedTitle,
        author: normalizedAuthor,
        price: normalizedPrice,
        description: normalizedDescription,
        image: normalizedImage,
        publication_date: validatePublicationDate(publication_date),
        quantity: normalizedQuantity,
        discount: normalizedDiscount,
        purchase_price: normalizedPurchasePrice,
        categoryIds: normalizedCategoryIds,
    });

    const fullBook = await bookModel.findById(createdBook.id);
    return fullBook;
}

async function updateBook(id, updateData) {
    const bookId = validateBookId(id);
    if (updateData === null || typeof updateData !== "object" || Array.isArray(updateData)) {
        throw new AppError("Dữ liệu cập nhật không hợp lệ.", 400);
    }

    const existingBook = await bookModel.findById(bookId, { includeDeleted: true });
    if (!existingBook) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }
    if (existingBook.isDelete) {
        throw new AppError("Không thể chỉnh sửa sách đã ẩn. Hãy khôi phục sách trước.", 400);
    }

    const payload = {};
    if (updateData.title !== undefined) {
        payload.title = validateRequiredText(updateData.title, "Tiêu đề sách không được để trống.", "Tiêu đề sách không được vượt quá 255 ký tự.");
    }
    if (updateData.author !== undefined) {
        payload.author = validateRequiredText(updateData.author, "Tên tác giả không được để trống.", "Tên tác giả không được vượt quá 255 ký tự.");
    }
    if (updateData.price !== undefined) payload.price = validateNumber(updateData.price, "Giá bán sách phải lớn hơn 0.", { min: 1 });
    if (updateData.description !== undefined) payload.description = validateOptionalText(updateData.description, "Mô tả sách không hợp lệ.", 4000);
    if (updateData.image !== undefined) payload.image = validateOptionalText(updateData.image, "Ảnh sách không hợp lệ.", 255);
    if (updateData.publication_date !== undefined) payload.publication_date = validatePublicationDate(updateData.publication_date);
    if (updateData.quantity !== undefined) payload.quantity = validateNumber(updateData.quantity, "Số lượng tồn kho không được nhỏ hơn 0.", { min: 0 });
    if (updateData.discount !== undefined) payload.discount = validateNumber(updateData.discount, "Tỉ lệ giảm giá phải từ 0% đến 100%.", { min: 0, max: 100 });
    if (updateData.purchase_price !== undefined) payload.purchase_price = validateNumber(updateData.purchase_price, "Giá nhập kho không được nhỏ hơn 0.", { min: 0 });

    const categoryIds = updateData.categoryIds === undefined
        ? null
        : validateCategoryIds(updateData.categoryIds);
    const updatedBook = await bookModel.update(bookId, payload, categoryIds);
    if (!updatedBook) {
        throw new AppError("Sách không còn ở trạng thái có thể chỉnh sửa.", 409);
    }
    return await bookModel.findById(bookId);
}

async function changeBookStatus(id, isDelete) {
    const bookId = validateBookId(id);

    const existingBook = await bookModel.findById(bookId, { includeDeleted: true });
    if (!existingBook) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }

    const flag = Number(isDelete);
    if (flag !== 0 && flag !== 1) {
        throw new AppError("Trạng thái isDelete phải là 0 hoặc 1.", 400);
    }
    if (flag === existingBook.isDelete) {
        return {
            message: flag === 1 ? "Sách đã được ẩn." : "Sách đang được kinh doanh.",
            isDelete: flag,
        };
    }

    if (flag === 1) {
        const deletedBook = await bookModel.softDelete(bookId);
        if (!deletedBook) throw new AppError("Trạng thái sách đã thay đổi, vui lòng thử lại.", 409);
        return { message: "Ngừng kinh doanh sách thành công.", isDelete: 1 };
    }

    const restoredBook = await bookModel.restore(bookId);
    if (!restoredBook) throw new AppError("Trạng thái sách đã thay đổi, vui lòng thử lại.", 409);
    return { message: "Khôi phục kinh doanh sách thành công.", isDelete: 0 };
}

async function getBookById(id) {
    const bookId = validateBookId(id);
    const book = await bookModel.findById(bookId, { includeDeleted: true });
    if (!book) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }
    return book;
}

module.exports = {
    createBook,
    updateBook,
    changeBookStatus,
    getBookById,
};
