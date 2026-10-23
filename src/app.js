const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { SqliteSessionStore } = require("./db/session-store");
const { attachCsrf, verifyCsrf, verifyOrigin } = require("./middleware/security");
const { createAuthRouter } = require("./routes/auth");
const { createTransactionRouter } = require("./routes/transactions");
const { createDashboardRouter } = require("./routes/dashboard");
const { createBudgetRouter } = require("./routes/budgets");
const { createReceiptRouter } = require("./routes/receipts");
const { createStorage } = require("./services/storage");

function createApp(db) {
  const app = express();
  const store = new SqliteSessionStore(db);
  const storage = createStorage();
  const isProd = process.env.NODE_ENV === "production";

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"]
        }
      },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" }
    })
  );

  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));

  app.use(
    session({
      name: "cet.sid",
      secret: process.env.SESSION_SECRET || "dev-only-change-me",
      store,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === "true" || (isProd && process.env.COOKIE_SECURE !== "false"),
        sameSite: process.env.COOKIE_SAMESITE || "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000
      }
    })
  );

  app.use(attachCsrf);
  app.use(verifyOrigin);

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "test" ? 1000 : 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts. Try again in 15 minutes." }
  });

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === "test" ? 5000 : 400,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use("/api", apiLimiter);
  app.use("/api/auth/login", loginLimiter);
  app.use("/api/auth/register", loginLimiter);

  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/auth/login") || req.path.startsWith("/auth/register")) {
      return next();
    }
    return verifyCsrf(req, res, next);
  });

  app.use("/api/auth", createAuthRouter(db));
  app.use("/api/transactions", createTransactionRouter(db, storage));
  app.use("/api/dashboard", createDashboardRouter(db));
  app.use("/api/budgets", createBudgetRouter(db));
  app.use("/api/receipts", createReceiptRouter(db, storage));

  app.use(express.static(path.join(__dirname, "../public")));

  app.get("/health", (req, res) => {
    res.json({ ok: true, storage: process.env.STORAGE_DRIVER || "local" });
  });

  app.use((req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found." });
    }
    return res.status(404).sendFile(path.join(__dirname, "../public/index.html"));
  });

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
      return next(err);
    }
    res.status(500).json({ error: "Unexpected server error." });
  });

  setInterval(() => store.purgeExpired(), 60 * 60 * 1000).unref();

  return app;
}

module.exports = { createApp };
