const crypto = require("crypto");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Please log in to continue." });
  }
  return next();
}

function attachCsrf(req, res, next) {
  if (!req.session) {
    return next();
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return next();
}

function verifyCsrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const token = req.get("x-csrf-token");
  if (!req.session || !req.session.csrfToken || !token) {
    return res.status(403).json({ error: "Missing CSRF token." });
  }
  const expected = Buffer.from(req.session.csrfToken);
  const received = Buffer.from(token);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(403).json({ error: "Invalid CSRF token." });
  }
  return next();
}

function verifyOrigin(req, res, next) {
  if (process.env.NODE_ENV !== "production") {
    return next();
  }
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }
  const origin = req.get("origin") || req.get("referer") || "";
  const allowed = process.env.APP_ORIGIN || "";
  if (!allowed) {
    return res.status(403).json({ error: "APP_ORIGIN is not configured." });
  }
  if (!origin.startsWith(allowed)) {
    return res.status(403).json({ error: "Invalid request origin." });
  }
  return next();
}

function safeKeyPath(key) {
  if (typeof key !== "string") {
    return null;
  }
  if (!key.startsWith("receipts/")) {
    return null;
  }
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    return null;
  }
  return key;
}

module.exports = { requireAuth, attachCsrf, verifyCsrf, verifyOrigin, safeKeyPath };
