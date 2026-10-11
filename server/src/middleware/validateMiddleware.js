const { validationResult } = require("express-validator");

function validate(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Dữ liệu không hợp lệ.", errors: errors.array().map(({ path, msg }) => ({ field: path, message: msg })) });
    }
    next();
}

module.exports = validate;
