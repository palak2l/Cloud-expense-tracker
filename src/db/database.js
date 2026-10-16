const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

function resolveDbPath() {
  if (process.env.DATABASE_PATH) {
    return path.resolve(process.env.DATABASE_PATH);
  }
  return path.resolve(__dirname, "../../data/expense-tracker.sqlite");
}

function openDatabase(dbPath = resolveDbPath()) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma("foreign_keys = ON");
  db.pragma("journal_mode = WAL");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
}

module.exports = { openDatabase, resolveDbPath };
