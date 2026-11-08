const discountService = require("../services/discountService");

async function getActiveDiscounts(req, res) {
    const { page, limit, search } = req.query;
    const result = await discountService.getActiveDiscounts({ page, limit, search });
    res.json(result);
}

async function getById(req, res) {
    const discount = await discountService.getDiscountById(req.params.id);
    res.json(discount);
}

async function getByCode(req, res) {
    const discount = await discountService.getDiscountByCode(req.params.code);
    res.json(discount);
}

async function adminCreate(req, res) {
    const discount = await discountService.createDiscount(req.body);
    res.status(201).json(discount);
}

async function adminUpdate(req, res) {
    const discount = await discountService.updateDiscount(req.params.id, req.body);
    res.json(discount);
}

async function adminChangeStatus(req, res) {
    const discount = await discountService.changeDiscountStatus(req.params.id, req.body.isDelete);
    res.json(discount);
}

async function adminGetAll(req, res) {
    const result = await discountService.getAdminDiscounts(req.query);
    res.json(result);
}

async function adminGetById(req, res) {
    const discount = await discountService.getAdminDiscountById(req.params.id);
    res.json(discount);
}

module.exports = {
    getActiveDiscounts,
    getById,
    getByCode,
    adminCreate,
    adminUpdate,
    adminChangeStatus,
    adminGetAll,
    adminGetById
};
