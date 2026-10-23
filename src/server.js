const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const { openDatabase } = require("./db/database");
const { createApp } = require("./app");

if (process.env.NODE_ENV === "production" && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  console.error("SESSION_SECRET must be at least 32 characters in production.");
  process.exit(1);
}

const db = openDatabase();
const app = createApp(db);
const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`Cloud Expense Tracker listening on http://localhost:${port}`);
});
