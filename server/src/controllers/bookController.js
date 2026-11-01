const bookService = require("../services/bookService");

async function create(req, res) {
    const book = await bookService.createBook(req.body);
    res.status(201).json(book);
}

async function update(req, res) {
    const book = await bookService.updateBook(req.params.id, req.body);
    res.json(book);
}

async function changeStatus(req, res) {
    const result = await bookService.changeBookStatus(req.params.id, req.body.isDelete);
    res.json(result);
}

async function getById(req, res) {
    const book = await bookService.getBookById(req.params.id);
    res.json(book);
}

async function getAllClient(req, res) {
    const books = await bookService.getClientBooks(req.query);
    res.json(books);
}

async function getDetailClient(req, res) {
    const book = await bookService.getClientBookDetail(req.params.id);
    res.json(book);
}

module.exports = {
    create,
    update,
    changeStatus,
    getById,
    getAllClient,
    getDetailClient,
};
