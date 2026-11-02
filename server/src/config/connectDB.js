const sql = require("mssql");

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER || "localhost",
    port: Number(process.env.DB_PORT || 1433),
    database: process.env.DB_NAME || "BookStore",
    options: {
        encrypt: process.env.DB_ENCRYPT === "true",
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE !== "false",
    },
};

let poolPromise;

function connectDB() {
    if (!poolPromise) {
        poolPromise = sql.connect(dbConfig).catch((error) => {
            poolPromise = undefined;
            throw error;
        });
    }
    return poolPromise;
}

module.exports = { sql, connectDB };
