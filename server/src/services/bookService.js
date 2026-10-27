const bookModel = require("../models/bookModel");
const categoryModel = require("../models/categoryModel");
const AppError = require("../utils/AppError");

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
    if (!title || !title.trim()) {
        throw new AppError("Tiêu đề sách không được để trống.", 400);
    }
    if (!author || !author.trim()) {
        throw new AppError("Tên tác giả không được để trống.", 400);
    }
    if (price === undefined || price === null || Number(price) <= 0) {
        throw new AppError("Giá bán sách phải lớn hơn 0.", 400);
    }
    if (quantity !== undefined && Number(quantity) < 0) {
        throw new AppError("Số lượng tồn kho không được nhỏ hơn 0.", 400);
    }
    if (discount !== undefined && (Number(discount) < 0 || Number(discount) > 100)) {
        throw new AppError("Tỉ lệ giảm giá phải từ 0% đến 100%.", 400);
    }

    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
        for (const catId of categoryIds) {
            const cat = await categoryModel.findById(catId);
            if (!cat) {
                throw new AppError(`Thể loại với ID ${catId} không tồn tại.`, 400);
            }
        }
    }

    const createdBook = await bookModel.create({
        title: title.trim(),
        author: author.trim(),
        price: Number(price),
        description: description ? description.trim() : null,
        image: image ? image.trim() : null,
        publication_date: publication_date || null,
        quantity: Number(quantity) || 0,
        discount: Number(discount) || 0,
        purchase_price: Number(purchase_price) || 0,
        categoryIds,
    });

    const fullBook = await bookModel.findById(createdBook.id);
    return fullBook;
}

async function updateBook(id, updateData) {
    const bookId = Number(id);
    if (!bookId || Number.isNaN(bookId)) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }

    const existingBook = await bookModel.findById(bookId);
    if (!existingBook) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }

    if (updateData.price !== undefined && Number(updateData.price) <= 0) {
        throw new AppError("Giá bán sách phải lớn hơn 0.", 400);
    }
    if (updateData.quantity !== undefined && Number(updateData.quantity) < 0) {
        throw new AppError("Số lượng tồn kho không được nhỏ hơn 0.", 400);
    }
    if (updateData.discount !== undefined && (Number(updateData.discount) < 0 || Number(updateData.discount) > 100)) {
        throw new AppError("Tỉ lệ giảm giá phải từ 0% đến 100%.", 400);
    }

    if (Array.isArray(updateData.categoryIds) && updateData.categoryIds.length > 0) {
        for (const catId of updateData.categoryIds) {
            const cat = await categoryModel.findById(catId);
            if (!cat) {
                throw new AppError(`Thể loại với ID ${catId} không tồn tại.`, 400);
            }
        }
    }

    const payload = {};
    if (updateData.title !== undefined) payload.title = updateData.title.trim();
    if (updateData.author !== undefined) payload.author = updateData.author.trim();
    if (updateData.price !== undefined) payload.price = Number(updateData.price);
    if (updateData.description !== undefined) payload.description = updateData.description ? updateData.description.trim() : null;
    if (updateData.image !== undefined) payload.image = updateData.image ? updateData.image.trim() : null;
    if (updateData.publication_date !== undefined) payload.publication_date = updateData.publication_date;
    if (updateData.quantity !== undefined) payload.quantity = Number(updateData.quantity);
    if (updateData.discount !== undefined) payload.discount = Number(updateData.discount);
    if (updateData.purchase_price !== undefined) payload.purchase_price = Number(updateData.purchase_price);
    if (updateData.categoryIds !== undefined) payload.categoryIds = updateData.categoryIds;

    await bookModel.update(bookId, payload);
    return await bookModel.findById(bookId);
}

async function changeBookStatus(id, isDelete) {
    const bookId = Number(id);
    if (!bookId || Number.isNaN(bookId)) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }

    const existingBook = await bookModel.findById(bookId);
    if (!existingBook) {
        throw new AppError("Không tìm thấy ấn phẩm sách yêu cầu.", 404);
    }

    const flag = Number(isDelete);
    if (flag === 1) {
        await bookModel.softDelete(bookId);
        return { message: "Ngừng kinh doanh sách thành công.", isDelete: 1 };
    }

    await bookModel.restore(bookId);
    return { message: "Khôi phục kinh doanh sách thành công.", isDelete: 0 };
}

async function getBookById(id) {
    const bookId = Number(id);
    if (!bookId || Number.isNaN(bookId)) {
        throw new AppError("ID sách không hợp lệ.", 400);
    }
    const book = await bookModel.findById(bookId);
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
