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

module.exports = {
    getActiveDiscounts,
    getById,
    getByCode
};

