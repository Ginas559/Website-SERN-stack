const userService = require("../services/userService");

async function getProfile(req, res, next) {
    try {
        const user = await userService.getProfile(req.user.id);
        return res.status(200).json({
            status: "success",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

async function updateProfile(req, res, next) {
    try {
        const updatedUser = await userService.updateProfile(req.user.id, req.body);
        return res.status(200).json({
            status: "success",
            message: "Cập nhật thông tin cá nhân thành công.",
            data: updatedUser
        });
    } catch (error) {
        next(error);
    }
}

async function getAccountStatus(req, res, next) {
    try {
        const status = await userService.getAccountStatus(req.user.id);
        return res.status(200).json({
            status: "success",
            data: status
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    getAccountStatus
};

