const storePolicyService = require("../services/storePolicyService");

async function getShippingPolicy(req, res, next) {
    try {
        const policy = await storePolicyService.getShippingPolicy();
        return res.status(200).json({
            status: "success",
            data: policy
        });
    } catch (error) {
        next(error);
    }
}

async function adminGetAllPolicies(req, res, next) {
    try {
        const policies = await storePolicyService.getAllPolicies();
        return res.status(200).json({
            status: "success",
            data: policies
        });
    } catch (error) {
        next(error);
    }
}

async function adminGetShippingPolicy(req, res, next) {
    try {
        const policy = await storePolicyService.getShippingPolicy({ bypassCache: true });
        return res.status(200).json({
            status: "success",
            data: policy
        });
    } catch (error) {
        next(error);
    }
}

async function adminUpdateShippingPolicy(req, res, next) {
    try {
        const updated = await storePolicyService.updateShippingPolicy(
            {
                standardFee: req.body.standardFee,
                freeThreshold: req.body.freeThreshold,
                expectedUpdatedAt: req.body.expectedUpdatedAt
            },
            req.user?.id || null
        );
        return res.status(200).json({
            status: "success",
            message: "Cập nhật chính sách vận chuyển toàn shop thành công.",
            data: updated
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getShippingPolicy,
    adminGetAllPolicies,
    adminGetShippingPolicy,
    adminUpdateShippingPolicy
};

