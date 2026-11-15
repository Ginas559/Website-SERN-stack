const ghnService = require("../services/ghnService");

async function getProvinces(req, res, next) {
    try {
        const provinces = await ghnService.getProvinces();
        return res.status(200).json({
            status: "success",
            data: provinces
        });
    } catch (error) {
        next(error);
    }
}

async function getDistricts(req, res, next) {
    try {
        const { provinceId } = req.params;
        const districts = await ghnService.getDistricts(provinceId);
        return res.status(200).json({
            status: "success",
            data: districts
        });
    } catch (error) {
        next(error);
    }
}

async function getWards(req, res, next) {
    try {
        const { districtId } = req.params;
        const wards = await ghnService.getWards(districtId);
        return res.status(200).json({
            status: "success",
            data: wards
        });
    } catch (error) {
        next(error);
    }
}

async function calculateFee(req, res, next) {
    try {
        const result = await ghnService.calculateShippingFee({
            toDistrictId: req.body.toDistrictId,
            toWardCode: req.body.toWardCode,
            weightInGrams: req.body.weightInGrams,
            lengthCm: req.body.lengthCm,
            widthCm: req.body.widthCm,
            heightCm: req.body.heightCm,
            insuranceValue: req.body.insuranceValue,
            orderTotal: req.body.orderTotal,
            provinceName: req.body.provinceName,
            provinceId: req.body.provinceId
        });
        return res.status(200).json({
            status: "success",
            data: result
        });
    } catch (error) {
        next(error);
    }
}

async function trackOrder(req, res, next) {
    try {
        const { orderCode } = req.params;
        const detail = await ghnService.getShippingOrderDetail(orderCode);
        if (detail && detail.status === "delivered") {
            const orderService = require("../services/orderService");
            await orderService.syncGhnDelivered(orderCode);
        }
        return res.status(200).json({
            status: "success",
            data: detail
        });
    } catch (error) {
        next(error);
    }
}

async function handleGhnWebhook(req, res, next) {
    try {
        const body = req.body || {};
        const orderCode = body.OrderCode || body.order_code || body.data?.OrderCode || body.data?.order_code;
        const status = (body.Status || body.status || body.data?.Status || body.data?.status || "").toLowerCase();

        if (orderCode && status === "delivered") {
            const orderService = require("../services/orderService");
            await orderService.syncGhnDelivered(orderCode);
        }

        return res.status(200).json({
            status: "success",
            message: "Webhook processed"
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProvinces,
    getDistricts,
    getWards,
    calculateFee,
    trackOrder,
    handleGhnWebhook
};
