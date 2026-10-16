const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });
const { resolveDbPath } = require("../src/db/database");

const source = resolveDbPath();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.resolve(__dirname, "../backups");
fs.mkdirSync(backupDir, { recursive: true });

if (!fs.existsSync(source)) {
  console.error(`Database not found at ${source}`);
  process.exit(1);
}

const target = path.join(backupDir, `expense-tracker-${stamp}.sqlite`);
fs.copyFileSync(source, target);

const wal = `${source}-wal`;
const shm = `${source}-shm`;
if (fs.existsSync(wal)) {
  fs.copyFileSync(wal, `${target}-wal`);
}
if (fs.existsSync(shm)) {
  fs.copyFileSync(shm, `${target}-shm`);
}

console.log(`Backup written to ${target}`);
