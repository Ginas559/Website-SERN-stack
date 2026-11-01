class AppError extends Error {
    constructor(message, statusCode = 500, cause) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        if (cause) this.cause = cause;
    }
}

module.exports = AppError;
