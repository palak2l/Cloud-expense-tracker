const express = require("express");
const bcrypt = require("bcrypt");
const { validateLogin, validateRegister } = require("../utils/validation");

function createAuthRouter(db) {
  const router = express.Router();
  const findByEmail = db.prepare("SELECT * FROM users WHERE email = ?");
  const insertUser = db.prepare(
    "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)"
  );
  const findById = db.prepare("SELECT id, name, email, created_at FROM users WHERE id = ?");

  router.get("/csrf", (req, res) => {
    res.json({ csrfToken: req.session.csrfToken });
  });

  router.get("/me", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ error: "Not authenticated." });
    }
    const user = findById.get(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Not authenticated." });
    }
    res.json({ user });
  });

  router.post("/register", async (req, res) => {
    const { errors, name, email, password } = validateRegister(req.body || {});
    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors });
    }
    if (findByEmail.get(email)) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = insertUser.run(name, email, passwordHash);
    req.session.userId = result.lastInsertRowid;
    req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
    const user = findById.get(result.lastInsertRowid);
    res.status(201).json({ user, csrfToken: req.session.csrfToken });
  });

  router.post("/login", async (req, res) => {
    const { errors, email, password } = validateLogin(req.body || {});
    if (errors.length) {
      return res.status(400).json({ error: errors[0], errors });
    }
    const record = findByEmail.get(email);
    if (!record) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const match = await bcrypt.compare(password, record.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not create a session." });
      }
      req.session.userId = record.id;
      req.session.csrfToken = require("crypto").randomBytes(32).toString("hex");
      res.json({
        user: { id: record.id, name: record.name, email: record.email, created_at: record.created_at },
        csrfToken: req.session.csrfToken
      });
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Could not log out." });
      }
      res.clearCookie("cet.sid");
      res.json({ ok: true });
    });
  });

  return router;
}

module.exports = { createAuthRouter };
