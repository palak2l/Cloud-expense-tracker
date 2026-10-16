const express = require("express");
const { requireAuth } = require("../middleware/security");
const { EXPENSE_CATEGORIES } = require("../utils/constants");

function monthKey(dateValue) {
  return String(dateValue).slice(0, 7);
}

function createDashboardRouter(db) {
  const router = express.Router();
  router.use(requireAuth);

  const allTx = db.prepare(
    "SELECT type, amount, category, date FROM transactions WHERE user_id = ?"
  );
  const budgetsStmt = db.prepare(
    "SELECT category, amount FROM budgets WHERE user_id = ? AND month = ?"
  );

  router.get("/summary", (req, res) => {
    const rows = allTx.all(req.session.userId);
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    let totalIncome = 0;
    let totalExpense = 0;
    let monthIncome = 0;
    let monthExpense = 0;
    const categoryTotals = {};
    const monthly = {};

    for (const row of rows) {
      const month = monthKey(row.date);
      if (!monthly[month]) {
        monthly[month] = { income: 0, expense: 0 };
      }
      if (row.type === "income") {
        totalIncome += row.amount;
        monthly[month].income += row.amount;
        if (month === thisMonth) {
          monthIncome += row.amount;
        }
      } else {
        totalExpense += row.amount;
        monthly[month].expense += row.amount;
        categoryTotals[row.category] = (categoryTotals[row.category] || 0) + row.amount;
        if (month === thisMonth) {
          monthExpense += row.amount;
        }
      }
    }

    const monthCategory = {};
    for (const row of rows) {
      if (row.type === "expense" && monthKey(row.date) === thisMonth) {
        monthCategory[row.category] = (monthCategory[row.category] || 0) + row.amount;
      }
    }

    const budgets = budgetsStmt.all(req.session.userId, thisMonth);
    const warnings = [];
    const budgetCards = EXPENSE_CATEGORIES.map((category) => {
      const budgetRow = budgets.find((item) => item.category === category);
      const spent = monthCategory[category] || 0;
      const limit = budgetRow ? budgetRow.amount : 0;
      const percent = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      if (limit > 0 && spent >= limit) {
        warnings.push(`${category} is over budget (₹${spent.toFixed(2)} / ₹${limit.toFixed(2)}).`);
      } else if (limit > 0 && spent >= limit * 0.8) {
        warnings.push(`${category} has used ${percent}% of its monthly budget.`);
      }
      return { category, spent, limit, percent };
    });

    const months = Object.keys(monthly).sort();
    const trend = months.map((month) => ({
      month,
      income: Math.round(monthly[month].income * 100) / 100,
      expense: Math.round(monthly[month].expense * 100) / 100
    }));

    const categoryChart = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount: Math.round(amount * 100) / 100
      }))
      .sort((a, b) => b.amount - a.amount);

    res.json({
      summary: {
        totalIncome: Math.round(totalIncome * 100) / 100,
        totalExpense: Math.round(totalExpense * 100) / 100,
        balance: Math.round((totalIncome - totalExpense) * 100) / 100,
        monthlySavings: Math.round((monthIncome - monthExpense) * 100) / 100,
        monthIncome: Math.round(monthIncome * 100) / 100,
        monthExpense: Math.round(monthExpense * 100) / 100,
        month: thisMonth
      },
      categoryChart,
      trend,
      budgetCards,
      warnings
    });
  });

  return router;
}

module.exports = { createDashboardRouter };
