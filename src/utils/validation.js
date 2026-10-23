const { CATEGORIES } = require("./constants");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 120;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function isYearMonth(value) {
  return /^\d{4}-\d{2}$/.test(value);
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function parseBudgetAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0 || amount > 100000000) {
    return null;
  }
  return Math.round(amount * 100) / 100;
}

function validateRegister(body) {
  const name = cleanString(body.name, 80);
  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const errors = [];
  if (name.length < 2) {
    errors.push("Name must be at least 2 characters.");
  }
  if (!isEmail(email)) {
    errors.push("A valid email is required.");
  }
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (password.length > 72) {
    errors.push("Password is too long.");
  }
  return { errors, name, email, password };
}

function validateLogin(body) {
  const email = cleanString(body.email, 120).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const errors = [];
  if (!isEmail(email)) {
    errors.push("A valid email is required.");
  }
  if (!password) {
    errors.push("Password is required.");
  }
  return { errors, email, password };
}

function validateTransaction(body) {
  const type = cleanString(body.type, 20);
  const category = cleanString(body.category, 40);
  const description = cleanString(body.description || "", 200);
  const date = cleanString(body.date, 10);
  const amount = parseAmount(body.amount);
  const errors = [];
  if (type !== "income" && type !== "expense") {
    errors.push("Type must be income or expense.");
  }
  if (!CATEGORIES.includes(category)) {
    errors.push("Choose a valid category.");
  }
  if (type === "income" && category !== "Salary" && category !== "Other") {
    errors.push("Income categories are Salary or Other.");
  }
  if (type === "expense" && category === "Salary") {
    errors.push("Salary cannot be used for expenses.");
  }
  if (amount === null) {
    errors.push("Enter a valid amount greater than 0.");
  }
  if (!isIsoDate(date)) {
    errors.push("Date must be YYYY-MM-DD.");
  }
  return { errors, type, category, description, date, amount };
}

function validateBudget(body) {
  const category = cleanString(body.category, 40);
  const month = cleanString(body.month, 7);
  const amount = parseBudgetAmount(body.amount);
  const errors = [];
  if (!CATEGORIES.includes(category) || category === "Salary") {
    errors.push("Choose a valid expense category.");
  }
  if (!isYearMonth(month)) {
    errors.push("Month must be YYYY-MM.");
  }
  if (amount === null) {
    errors.push("Enter a valid budget amount of 0 or more.");
  }
  return { errors, category, month, amount };
}

module.exports = {
  escapeHtml,
  cleanString,
  isIsoDate,
  isYearMonth,
  validateRegister,
  validateLogin,
  validateTransaction,
  validateBudget
};
