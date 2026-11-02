const express = require("express");
const { protect, restrictTo } = require("../middleware/authMiddleware");
const userModel = require("../models/userModel");
const AppError = require("../utils/AppError");

const router = express.Router();
router.get("/me", protect, async (req, res, next) => {
    try {
        const user = await userModel.findById(req.user.id);
        if (!user || user.isDelete) return next(new AppError("Tài khoản không tồn tại.", 404));
        res.json({ user: { id: user.id, username: user.username, fullName: user.full_name, email: user.email, isAdmin: Boolean(user.isAdmin) } });
    } catch (error) { next(error); }
});
router.get("/admin-check", protect, restrictTo("Admin"), (req, res) => res.json({ message: "Bạn có quyền Admin.", user: req.user }));
module.exports = router;
