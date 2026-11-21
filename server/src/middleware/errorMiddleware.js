function errorHandler(error, req, res, next) {
    const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    const isOperational = Boolean(error.isOperational) && statusCode < 500;

    if (!isOperational) {
        console.error({
            method: req.method,
            path: req.originalUrl,
            statusCode,
            error
        });
    }

    res.status(statusCode).json({
        message: isOperational ? error.message : "Đã xảy ra lỗi máy chủ."
    });
}

module.exports = errorHandler;
