const categoryService = require("../services/categoryService");

async function create(req, res) {
    const category = await categoryService.createCategory(req.body);
    res.status(201).json(category);
}

async function update(req, res) {
    const category = await categoryService.updateCategory(req.params.id, req.body);
    res.json(category);
}

async function changeStatus(req, res) {
    const { isDelete } = req.body;
    const category = isDelete
        ? await categoryService.softDeleteCategory(req.params.id)
        : await categoryService.restoreCategory(req.params.id);
    res.json(category);
}

async function getAll(req, res) {
    const categories = await categoryService.getAdminCategories();
    res.json(categories);
}

async function getById(req, res) {
    const category = await categoryService.getCategoryById(req.params.id);
    res.json(category);
}

module.exports = {
    create,
    update,
    changeStatus,
    getAll,
    getById,
};
