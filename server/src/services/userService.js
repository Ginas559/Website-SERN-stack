const userModel = require("../models/userModel");
const AppError = require("../utils/AppError");

function validateProfileUpdate({ fullName, phoneNumber, address, avatar }) {
    if (fullName !== undefined) {
        if (fullName !== null && typeof fullName !== "string") {
            throw new AppError("Họ và tên không hợp lệ.", 400);
        }
        if (typeof fullName === "string" && fullName.trim().length > 100) {
            throw new AppError("Họ và tên không được vượt quá 100 ký tự.", 400);
        }
    }

    if (phoneNumber !== undefined) {
        if (phoneNumber !== null && typeof phoneNumber !== "string") {
            throw new AppError("Số điện thoại không hợp lệ.", 400);
        }
        if (typeof phoneNumber === "string" && phoneNumber.trim()) {
            const cleanPhone = phoneNumber.trim();
            const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
            if (!phoneRegex.test(cleanPhone)) {
                throw new AppError("Định dạng số điện thoại không hợp lệ.", 400);
            }
            if (cleanPhone.length > 20) {
                throw new AppError("Số điện thoại không được vượt quá 20 ký tự.", 400);
            }
        }
    }

    if (address !== undefined) {
        if (address !== null && typeof address !== "string") {
            throw new AppError("Địa chỉ không hợp lệ.", 400);
        }
        if (typeof address === "string" && address.trim().length > 255) {
            throw new AppError("Địa chỉ không được vượt quá 255 ký tự.", 400);
        }
    }

    if (avatar !== undefined) {
        if (avatar !== null && typeof avatar !== "string") {
            throw new AppError("Đường dẫn ảnh đại diện không hợp lệ.", 400);
        }
        if (typeof avatar === "string" && avatar.trim().length > 255) {
            throw new AppError("Đường dẫn ảnh đại diện không được vượt quá 255 ký tự.", 400);
        }
    }
}

async function getProfile(userId) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const user = await userModel.findByIdSafe(userId);
    if (!user) {
        const status = await userModel.findStatusById(userId);
        if (status && status.isDelete === 1) {
            const reason = status.blockReason ? `: ${status.blockReason}` : "";
            throw new AppError(`Tài khoản của bạn đã bị khóa${reason}.`, 403);
        }
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }

    return user;
}

async function updateProfile(userId, updateData = {}) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const status = await userModel.findStatusById(userId);
    if (!status) {
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }

    if (status.isDelete === 1) {
        const reason = status.blockReason ? `: ${status.blockReason}` : "";
        throw new AppError(`Tài khoản của bạn đã bị khóa${reason}.`, 403);
    }

    validateProfileUpdate(updateData);

    const cleanData = {};
    if (updateData.fullName !== undefined) {
        cleanData.fullName = updateData.fullName ? updateData.fullName.trim() : null;
    }
    if (updateData.phoneNumber !== undefined) {
        cleanData.phoneNumber = updateData.phoneNumber ? updateData.phoneNumber.trim() : null;
    }
    if (updateData.address !== undefined) {
        cleanData.address = updateData.address ? updateData.address.trim() : null;
    }
    if (updateData.avatar !== undefined) {
        cleanData.avatar = updateData.avatar ? updateData.avatar.trim() : null;
    }

    const updated = await userModel.updateProfile(userId, cleanData);
    if (!updated) {
        throw new AppError("Cập nhật thông tin người dùng thất bại.", 400);
    }

    return updated;
}

async function getAccountStatus(userId) {
    if (!userId) {
        throw new AppError("Người dùng không hợp lệ.", 401);
    }

    const status = await userModel.findStatusById(userId);
    if (!status) {
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }

    return {
        id: status.id,
        isBlocked: status.isDelete === 1,
        blockReason: status.blockReason || null,
        isVerified: Boolean(status.isVerified),
        isVip: Boolean(status.isVip)
    };
}

module.exports = {
    getProfile,
    updateProfile,
    getAccountStatus
};

