const express = require("express");
const { requireAuth } = require("../middleware/security");
const { validateBudget, isYearMonth } = require("../utils/validation");
const { EXPENSE_CATEGORIES } = require("../utils/constants");

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function createBudgetRouter(db) {
  const router = express.Router();
  router.use(requireAuth);

  const listStmt = db.prepare(
    "SELECT id, category, month, amount FROM budgets WHERE user_id = ? AND month = ? ORDER BY category"
  );
  const upsertStmt = db.prepare(`
    INSERT INTO budgets (user_id, category, month, amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, category, month)
    DO UPDATE SET amount = excluded.amount, updated_at = datetime('now')
  `);

  router.get("/", (req, res) => {
    const month = isYearMonth(req.query.month || "") ? req.query.month : currentMonth();
    const rows = listStmt.all(req.session.userId, month);
    const byCategory = Object.fromEntries(rows.map((row) => [row.category, row.amount]));
    res.json({
      month,
      budgets: EXPENSE_CATEGORIES.map((category) => ({
        category,
        amount: byCategory[category] || 0
      }))
    });
  });

  router.put("/", (req, res) => {
    const parsed = validateBudget(req.body || {});
    if (parsed.errors.length) {
      return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
    }
    upsertStmt.run(req.session.userId, parsed.category, parsed.month, parsed.amount);
    res.json({ ok: true, category: parsed.category, month: parsed.month, amount: parsed.amount });
  });

  return router;
}

module.exports = { createBudgetRouter };
