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

async function adminGetAll(req, res, next) {
    try {
        const result = await userService.getAdminUsers(req.query);
        return res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

async function adminGetById(req, res, next) {
    try {
        const user = await userService.getAdminUserById(req.params.id);
        return res.status(200).json(user);
    } catch (error) {
        next(error);
    }
}

async function adminChangeStatus(req, res, next) {
    try {
        const user = await userService.changeUserStatus(
            req.params.id,
            { isDelete: req.body.isDelete, blockReason: req.body.blockReason },
            req.user.id
        );
        return res.status(200).json({
            status: "success",
            message: Number(req.body.isDelete) === 1 ? "Đã chặn người dùng thành công." : "Đã khôi phục người dùng thành công.",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

async function adminBlockUser(req, res, next) {
    try {
        const user = await userService.blockUser(
            req.params.id,
            { blockReason: req.body.blockReason || req.body.reason },
            req.user.id
        );
        return res.status(200).json({
            status: "success",
            message: "Đã chặn người dùng thành công.",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

async function adminRestoreUser(req, res, next) {
    try {
        const user = await userService.restoreUser(req.params.id);
        return res.status(200).json({
            status: "success",
            message: "Đã khôi phục người dùng thành công.",
            data: user
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getProfile,
    updateProfile,
    getAccountStatus,
    adminGetAll,
    adminGetById,
    adminChangeStatus,
    adminBlockUser,
    adminRestoreUser
};

