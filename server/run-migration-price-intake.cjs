const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Re-use the same database file
const DB_PATH = path.join(__dirname, 'kourosh_inventory.db');
const MIGRATION_FILE = path.join(__dirname, 'migrations', '2025-08-16-price-intake.sql');

console.log(`[Migration Runner] Connecting to DB at ${DB_PATH}`);
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        return console.error('Could not connect to database', err.message);
    }
    console.log('[Migration Runner] Connected to the SQLite database.');
});

db.serialize(() => {
    console.log(`[Migration Runner] Reading migration file: ${MIGRATION_FILE}`);
    const migrationSql = fs.readFileSync(MIGRATION_FILE, 'utf8');

    console.log('[Migration Runner] Executing migration...');
    db.exec(migrationSql, (err) => {
        if (err) {
            return console.error('[Migration Runner] Error running migration script:', err.message);
        }
        console.log("[Migration Runner] Migration from 2025-08-16-price-intake.sql applied successfully.");
    });
});

db.close((err) => {
    if (err) {
        return console.error('[Migration Runner] Error closing the database connection:', err.message);
    }
    console.log('[Migration Runner] Closed the database connection.');
});
