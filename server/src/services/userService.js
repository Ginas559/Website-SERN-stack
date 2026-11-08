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

async function getAdminUsers(queryParams = {}) {
    const {
        page = 1,
        limit = 10,
        search,
        isDelete,
        isAdmin,
        isVerified,
        isVip,
        sortBy = "createdAt",
        sortOrder = "DESC"
    } = queryParams;

    if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
        throw new AppError("Số trang phải là số nguyên lớn hơn 0.", 400);
    }
    if (limit !== undefined && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
        throw new AppError("Số lượng mỗi trang phải từ 1 đến 100.", 400);
    }

    return userModel.findAllForAdmin({
        page,
        limit,
        search,
        isDelete,
        isAdmin,
        isVerified,
        isVip,
        sortBy,
        sortOrder
    });
}

async function getAdminUserById(userId) {
    if (!userId) {
        throw new AppError("ID người dùng không hợp lệ.", 400);
    }
    const user = await userModel.findByIdAdmin(userId);
    if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }
    return user;
}

async function blockUser(targetUserId, { blockReason = null } = {}, adminId) {
    if (!targetUserId) {
        throw new AppError("ID người dùng không hợp lệ.", 400);
    }
    if (adminId && String(targetUserId).trim() === String(adminId).trim()) {
        throw new AppError("Không thể tự chặn tài khoản của chính mình.", 400);
    }

    const user = await userModel.findByIdAdmin(targetUserId);
    if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }

    if (user.isAdmin === 1) {
        throw new AppError("Không thể chặn tài khoản Quản trị viên.", 403);
    }

    const cleanReason = blockReason && typeof blockReason === "string" ? blockReason.trim() : null;
    if (cleanReason && cleanReason.length > 255) {
        throw new AppError("Lý do chặn không được vượt quá 255 ký tự.", 400);
    }

    if (user.isDelete === 1) {
        return user;
    }

    const blockedUser = await userModel.block(targetUserId, cleanReason);
    if (!blockedUser) {
        throw new AppError("Trạng thái người dùng đã thay đổi, vui lòng thử lại.", 409);
    }

    await userModel.revokeUserRefreshTokens(targetUserId);
    return blockedUser;
}

async function restoreUser(targetUserId) {
    if (!targetUserId) {
        throw new AppError("ID người dùng không hợp lệ.", 400);
    }

    const user = await userModel.findByIdAdmin(targetUserId);
    if (!user) {
        throw new AppError("Không tìm thấy thông tin người dùng.", 404);
    }

    if (user.isDelete === 0) {
        return user;
    }

    const restoredUser = await userModel.restore(targetUserId);
    if (!restoredUser) {
        throw new AppError("Trạng thái người dùng đã thay đổi, vui lòng thử lại.", 409);
    }

    return restoredUser;
}

async function changeUserStatus(targetUserId, { isDelete, blockReason = null } = {}, adminId) {
    if (Number(isDelete) === 1) {
        return blockUser(targetUserId, { blockReason }, adminId);
    }
    if (Number(isDelete) === 0) {
        return restoreUser(targetUserId);
    }
    throw new AppError("Trạng thái isDelete không hợp lệ.", 400);
}

module.exports = {
    getProfile,
    updateProfile,
    getAccountStatus,
    getAdminUsers,
    getAdminUserById,
    blockUser,
    restoreUser,
    changeUserStatus
};

