const express = require("express");
const { requireAuth } = require("../middleware/security");
const { validateTransaction, cleanString, isIsoDate } = require("../utils/validation");

function csvCell(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function createTransactionRouter(db, storage) {
  const router = express.Router();
  router.use(requireAuth);

  const listStmt = db.prepare(`
    SELECT id, type, amount, category, description, date, receipt_key, receipt_name, created_at, updated_at
    FROM transactions
    WHERE user_id = ?
      AND (? = '' OR date >= ?)
      AND (? = '' OR date <= ?)
      AND (? = '' OR type = ?)
      AND (? = '' OR category = ?)
      AND (? = '' OR description LIKE ? OR category LIKE ?)
    ORDER BY date DESC, id DESC
  `);

  const getStmt = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?");
  const insertStmt = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, category, description, date)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateStmt = db.prepare(`
    UPDATE transactions
    SET type = ?, amount = ?, category = ?, description = ?, date = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `);
  const deleteStmt = db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?");

  router.get("/", (req, res) => {
    const from = isIsoDate(req.query.from || "") ? req.query.from : "";
    const to = isIsoDate(req.query.to || "") ? req.query.to : "";
    const type = req.query.type === "income" || req.query.type === "expense" ? req.query.type : "";
    const category = cleanString(req.query.category || "", 40);
    const q = cleanString(req.query.q || "", 80);
    const like = q ? `%${q}%` : "";
    const rows = listStmt.all(
      req.session.userId,
      from, from,
      to, to,
      type, type,
      category, category,
      q, like, like
    );
    res.json({ transactions: rows });
  });

  router.get("/export", (req, res) => {
    const from = isIsoDate(req.query.from || "") ? req.query.from : "";
    const to = isIsoDate(req.query.to || "") ? req.query.to : "";
    const rows = listStmt.all(
      req.session.userId,
      from, from,
      to, to,
      "", "",
      "", "",
      "", "", ""
    );
    const header = "Date,Type,Category,Description,Amount,Has Receipt\n";
    const body = rows
      .map((row) =>
        [
          csvCell(row.date),
          csvCell(row.type),
          csvCell(row.category),
          csvCell(row.description),
          csvCell(row.amount.toFixed(2)),
          csvCell(row.receipt_key ? "yes" : "no")
        ].join(",")
      )
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=expense-history.csv");
    res.send(header + body + (body ? "\n" : ""));
  });

  router.post("/", (req, res) => {
    const parsed = validateTransaction(req.body || {});
    if (parsed.errors.length) {
      return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
    }
    const result = insertStmt.run(
      req.session.userId,
      parsed.type,
      parsed.amount,
      parsed.category,
      parsed.description,
      parsed.date
    );
    const row = getStmt.get(result.lastInsertRowid, req.session.userId);
    res.status(201).json({ transaction: row });
  });

  router.put("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid transaction id." });
    }
    const existing = getStmt.get(id, req.session.userId);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    const parsed = validateTransaction(req.body || {});
    if (parsed.errors.length) {
      return res.status(400).json({ error: parsed.errors[0], errors: parsed.errors });
    }
    updateStmt.run(
      parsed.type,
      parsed.amount,
      parsed.category,
      parsed.description,
      parsed.date,
      id,
      req.session.userId
    );
    res.json({ transaction: getStmt.get(id, req.session.userId) });
  });

  router.delete("/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid transaction id." });
    }
    const existing = getStmt.get(id, req.session.userId);
    if (!existing) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    if (existing.receipt_key && storage) {
      storage.delete(existing.receipt_key).catch((error) => console.error("Receipt cleanup error:", error));
    }
    deleteStmt.run(id, req.session.userId);
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createTransactionRouter };
