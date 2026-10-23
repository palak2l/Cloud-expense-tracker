const CATEGORIES = [
  "Food",
  "Travel",
  "Shopping",
  "Education",
  "Bills",
  "Healthcare",
  "Entertainment",
  "Other",
  "Salary"
];

const EXPENSE_CATEGORIES = CATEGORIES.filter((item) => item !== "Salary");

const ALLOWED_RECEIPT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

const ALLOWED_RECEIPT_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);

module.exports = {
  CATEGORIES,
  EXPENSE_CATEGORIES,
  ALLOWED_RECEIPT_TYPES,
  ALLOWED_RECEIPT_EXTENSIONS
};
