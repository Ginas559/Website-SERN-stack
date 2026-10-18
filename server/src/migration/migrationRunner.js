require("dotenv").config();

const fs = require("fs/promises");
const path = require("path");
const { connectDB, sql } = require("../config/connectDB");

const migrationDirectory = __dirname;
const migrationTable = "dbo.DatabaseMigrations";

function splitBatches(script) {
    return script
        .split(/^\s*GO\s*$/gim)
        .map((batch) => batch.trim())
        .filter(Boolean);
}

async function ensureMigrationTable(pool) {
    await pool.request().query(`
        IF OBJECT_ID(N'${migrationTable}', N'U') IS NULL
        BEGIN
            CREATE TABLE ${migrationTable} (
                MigrationName NVARCHAR(255) NOT NULL PRIMARY KEY,
                AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
            );
        END;
    `);
}

async function getMigrationFiles() {
    const entries = await fs.readdir(migrationDirectory, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isFile() && /^\d+_.+\.sql$/i.test(entry.name))
        .map((entry) => entry.name)
        .sort((first, second) => first.localeCompare(second, "en", { numeric: true }));
}

async function getAppliedMigrations(pool) {
    const result = await pool.request().query(
        `SELECT MigrationName FROM ${migrationTable} ORDER BY MigrationName`,
    );
    return new Set(result.recordset.map((row) => row.MigrationName));
}

async function showStatus(pool) {
    await ensureMigrationTable(pool);
    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(pool);

    for (const file of files) {
        console.log(`${applied.has(file) ? "[x]" : "[ ]"} ${file}`);
    }
}

async function runMigration(pool, file) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
        const script = await fs.readFile(path.join(migrationDirectory, file), "utf8");
        for (const batch of splitBatches(script)) {
            await new sql.Request(transaction).query(batch);
        }

        await new sql.Request(transaction)
            .input("migrationName", sql.NVarChar(255), file)
            .query(`INSERT INTO ${migrationTable} (MigrationName) VALUES (@migrationName)`);
        await transaction.commit();
        console.log(`[x] ${file}`);
    } catch (error) {
        await transaction.rollback();
        throw new Error(`Migration failed: ${file}. ${error.message}`, { cause: error });
    }
}

async function runPendingMigrations(pool) {
    await ensureMigrationTable(pool);
    const files = await getMigrationFiles();
    const applied = await getAppliedMigrations(pool);
    const pending = files.filter((file) => !applied.has(file));

    if (pending.length === 0) {
        console.log("No pending migrations.");
        return;
    }

    for (const file of pending) {
        await runMigration(pool, file);
    }
}

async function main() {
    const pool = await connectDB();
    try {
        if (process.argv[2] === "status") {
            await showStatus(pool);
        } else if (!process.argv[2] || process.argv[2] === "run") {
            await runPendingMigrations(pool);
        } else {
            throw new Error("Unknown command. Use: npm run migration:status or npm run migration:run");
        }
    } finally {
        await pool.close();
    }
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
