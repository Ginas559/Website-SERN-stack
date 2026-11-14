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

function normalizePagination(options = {}) {
    const page = options.page === undefined ? 1 : Number(options.page);
    const limit = options.limit === undefined ? 10 : Number(options.limit);

    if (!Number.isFinite(page) || !Number.isInteger(page) || page <= 0) {
        throw new AppError("Số trang không hợp lệ.", 400);
    }
    if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0 || limit > 100) {
        throw new AppError("Số lượng mỗi trang phải là số nguyên từ 1 đến 100.", 400);
    }

    return { page, limit };
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

async function getClientBooks(options = {}) {
    const { page, limit } = normalizePagination(options);

    let minPrice = null;
    let maxPrice = null;

    if (options.minPrice !== undefined) {
        if (options.minPrice === null || (typeof options.minPrice === "string" && !options.minPrice.trim())) {
            throw new AppError("Giá tối thiểu không hợp lệ.", 400);
        }
        minPrice = Number(options.minPrice);
        if (!Number.isFinite(minPrice) || !Number.isInteger(minPrice) || minPrice < 0) {
            throw new AppError("Giá tối thiểu không hợp lệ.", 400);
        }
    }

    if (options.maxPrice !== undefined) {
        if (options.maxPrice === null || (typeof options.maxPrice === "string" && !options.maxPrice.trim())) {
            throw new AppError("Giá tối đa không hợp lệ.", 400);
        }
        maxPrice = Number(options.maxPrice);
        if (!Number.isFinite(maxPrice) || !Number.isInteger(maxPrice) || maxPrice < 0) {
            throw new AppError("Giá tối đa không hợp lệ.", 400);
        }
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        throw new AppError("Giá tối thiểu không được lớn hơn giá tối đa.", 400);
    }

    let categoryId = null;
    if (options.categoryId !== undefined && options.categoryId !== null && options.categoryId !== "") {
        categoryId = Number(options.categoryId);
        if (Number.isNaN(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
            throw new AppError("ID thể loại không hợp lệ.", 400);
        }
    }

    const allowedSorts = ["newest", "oldest", "price_asc", "price_desc", "discount"];
    const sort = allowedSorts.includes(options.sort) ? options.sort : "newest";

    const search = typeof options.search === "string" ? options.search.trim() : "";

    return await bookModel.findAllClient({
        page,
        limit,
        search,
        categoryId,
        minPrice,
        maxPrice,
        sort,
        includeDeleted: false,
    });
}

async function getClientBookDetail(id, relatedLimit = 4) {
    const bookId = Number(id);
    if (!bookId || !Number.isInteger(bookId) || bookId <= 0) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    const book = await bookModel.findByIdClient(bookId);
    if (!book || book.isDelete) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }
    const categoryIds = (book.categories || []).map((cat) => cat.id);
    const relatedBooks = await bookModel.findRelatedBooks(bookId, categoryIds, relatedLimit);
    return {
        ...book,
        relatedBooks,
    };
}

async function getAdminBooks(options = {}) {
    const { page, limit } = normalizePagination(options);

    let isDelete = null;
    if (options.isDelete !== undefined && options.isDelete !== null && options.isDelete !== "") {
        const parsedIsDelete = Number(options.isDelete);
        if (parsedIsDelete === 0 || parsedIsDelete === 1) {
            isDelete = parsedIsDelete;
        } else {
            throw new AppError("Trạng thái isDelete không hợp lệ.", 400);
        }
    }

    let minPrice = null;
    let maxPrice = null;

    if (options.minPrice !== undefined && options.minPrice !== null && options.minPrice !== "") {
        minPrice = Number(options.minPrice);
        if (Number.isNaN(minPrice) || minPrice < 0) {
            throw new AppError("Giá tối thiểu không hợp lệ.", 400);
        }
    }

    if (options.maxPrice !== undefined && options.maxPrice !== null && options.maxPrice !== "") {
        maxPrice = Number(options.maxPrice);
        if (Number.isNaN(maxPrice) || maxPrice < 0) {
            throw new AppError("Giá tối đa không hợp lệ.", 400);
        }
    }

    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        throw new AppError("Giá tối thiểu không được lớn hơn giá tối đa.", 400);
    }

    let categoryId = null;
    if (options.categoryId !== undefined && options.categoryId !== null && options.categoryId !== "") {
        categoryId = Number(options.categoryId);
        if (Number.isNaN(categoryId) || !Number.isInteger(categoryId) || categoryId <= 0) {
            throw new AppError("ID thể loại không hợp lệ.", 400);
        }
    }

    const allowedSorts = ["newest", "oldest", "price_asc", "price_desc", "discount"];
    const sort = allowedSorts.includes(options.sort) ? options.sort : "newest";

    const search = typeof options.search === "string" ? options.search.trim() : "";

    return await bookModel.findAll({
        page,
        limit,
        search,
        categoryId,
        minPrice,
        maxPrice,
        sort,
        includeDeleted: true,
        isDelete,
    });
}

module.exports = {
    createBook,
    updateBook,
    changeBookStatus,
    getBookById,
    getClientBooks,
    getClientBookDetail,
    getAdminBooks,
};
