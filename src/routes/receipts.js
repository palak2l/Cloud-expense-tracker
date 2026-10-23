const express = require("express");
const multer = require("multer");
const { requireAuth, safeKeyPath } = require("../middleware/security");
const { validateReceiptFile } = require("../services/storage");

function createReceiptRouter(db, storage) {
  const router = express.Router();
  router.use(requireAuth);

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Number(process.env.MAX_RECEIPT_BYTES || 5 * 1024 * 1024), files: 1 }
  });

  const getTx = db.prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?");
  const attachStmt = db.prepare(`
    UPDATE transactions
    SET receipt_key = ?, receipt_name = ?, receipt_mime = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `);
  const clearStmt = db.prepare(`
    UPDATE transactions
    SET receipt_key = NULL, receipt_name = NULL, receipt_mime = NULL, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `);

  router.post("/:id", (req, res, next) => {
    upload.single("receipt")(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: "Receipt upload failed. Check file type and size." });
      }
      return next();
    });
  }, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "Invalid transaction id." });
    }
    const tx = getTx.get(id, req.session.userId);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    const problem = validateReceiptFile(req.file);
    if (problem) {
      return res.status(400).json({ error: problem });
    }
    try {
      if (tx.receipt_key) {
        await storage.delete(tx.receipt_key);
      }
      const key = await storage.save(req.session.userId, req.file);
      attachStmt.run(key, req.file.originalname.slice(0, 120), req.file.mimetype, id, req.session.userId);
      res.status(201).json({
        ok: true,
        receipt: { name: req.file.originalname.slice(0, 120), attached: true }
      });
    } catch (error) {
      console.error("Receipt upload error:", error);
      res.status(500).json({ error: "Could not store the receipt." });
    }
  });

  router.get("/:id/url", async (req, res) => {
    const id = Number(req.params.id);
    const tx = getTx.get(id, req.session.userId);
    if (!tx || !tx.receipt_key) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    try {
      const url = await storage.getSignedUrl(tx.receipt_key);
      res.json({ url, name: tx.receipt_name, mime: tx.receipt_mime });
    } catch (error) {
      console.error("Receipt URL error:", error);
      res.status(500).json({ error: "Could not open the receipt." });
    }
  });

  router.get("/file", async (req, res) => {
    const key = safeKeyPath(req.query.key || "");
    if (!key) {
      return res.status(400).json({ error: "Invalid receipt key." });
    }
    const owned = db.prepare(
      "SELECT receipt_mime FROM transactions WHERE user_id = ? AND receipt_key = ?"
    ).get(req.session.userId, key);
    if (!owned) {
      return res.status(404).json({ error: "Receipt not found." });
    }
    try {
      const stream = await storage.getStream(key);
      if (!stream) {
        return res.status(404).json({ error: "Receipt file missing." });
      }
      res.setHeader("Content-Type", owned.receipt_mime || "application/octet-stream");
      res.setHeader("Content-Disposition", "inline");
      if (typeof stream.pipe === "function") {
        stream.pipe(res);
      } else {
        const chunks = [];
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        res.send(Buffer.concat(chunks));
      }
    } catch (error) {
      console.error("Receipt stream error:", error);
      res.status(500).json({ error: "Could not read the receipt." });
    }
  });

  router.delete("/:id", async (req, res) => {
    const id = Number(req.params.id);
    const tx = getTx.get(id, req.session.userId);
    if (!tx) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    try {
      if (tx.receipt_key) {
        await storage.delete(tx.receipt_key);
      }
      clearStmt.run(id, req.session.userId);
      res.json({ ok: true });
    } catch (error) {
      console.error("Receipt delete error:", error);
      res.status(500).json({ error: "Could not delete the receipt." });
    }
  });

  return router;
}

module.exports = { createReceiptRouter };
