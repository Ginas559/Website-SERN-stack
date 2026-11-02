function errorHandler(error, req, res, next) {
    console.error(error);
    res.status(error.statusCode || 500).json({ message: error.isOperational ? error.message : "Đã xảy ra lỗi máy chủ." });
}

module.exports = errorHandler;
