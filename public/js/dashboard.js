const EXPENSE_CATEGORIES = ["Food", "Travel", "Shopping", "Education", "Bills", "Healthcare", "Entertainment", "Other"];
const INCOME_CATEGORIES = ["Salary", "Other"];

let categoryChart;
let trendChart;

const themeBtn = document.getElementById("themeBtn");
themeBtn.textContent = CETTheme.label();
themeBtn.addEventListener("click", () => {
  CETTheme.toggle();
  themeBtn.textContent = CETTheme.label();
  refreshChartsTheme();
});

document.querySelectorAll(".nav-pills button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-pills button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".section").forEach((section) => section.classList.remove("visible"));
    document.getElementById(button.dataset.section).classList.add("visible");
  });
});

function fillCategorySelect(select, type, selected) {
  const list = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  select.innerHTML = list.map((item) => `<option ${item === selected ? "selected" : ""}>${item}</option>`).join("");
}

function chartColors() {
  const dark = CETTheme.current() === "dark";
  return {
    ink: dark ? "#eef4ff" : "#152238",
    grid: dark ? "rgba(186,210,255,0.12)" : "rgba(16,36,62,0.1)",
    palette: ["#6d4aff", "#14b8a6", "#10243e", "#fb923c", "#38bdf8", "#f472b6", "#84cc16", "#facc15"]
  };
}

function refreshChartsTheme() {
  if (window.lastSummary) {
    drawCharts(window.lastSummary);
  }
}

function drawCharts(data) {
  const colors = chartColors();
  const catEmpty = document.getElementById("catEmpty");
  const trendEmpty = document.getElementById("trendEmpty");
  if (categoryChart) {
    categoryChart.destroy();
  }
  if (trendChart) {
    trendChart.destroy();
  }
  if (!data.categoryChart.length) {
    catEmpty.classList.remove("hidden");
  } else {
    catEmpty.classList.add("hidden");
    categoryChart = new Chart(document.getElementById("categoryChart"), {
      type: "doughnut",
      data: {
        labels: data.categoryChart.map((row) => row.category),
        datasets: [{ data: data.categoryChart.map((row) => row.amount), backgroundColor: colors.palette }]
      },
      options: { plugins: { legend: { labels: { color: colors.ink } } } }
    });
  }
  if (!data.trend.length) {
    trendEmpty.classList.remove("hidden");
  } else {
    trendEmpty.classList.add("hidden");
    trendChart = new Chart(document.getElementById("trendChart"), {
      type: "line",
      data: {
        labels: data.trend.map((row) => row.month),
        datasets: [
          { label: "Income", data: data.trend.map((row) => row.income), borderColor: "#14b8a6", tension: 0.35 },
          { label: "Expenses", data: data.trend.map((row) => row.expense), borderColor: "#6d4aff", tension: 0.35 }
        ]
      },
      options: {
        plugins: { legend: { labels: { color: colors.ink } } },
        scales: {
          x: { ticks: { color: colors.ink }, grid: { color: colors.grid } },
          y: { ticks: { color: colors.ink }, grid: { color: colors.grid } }
        }
      }
    });
  }
}

async function loadSummary() {
  const data = await CET.request("/api/dashboard/summary");
  window.lastSummary = data;
  document.getElementById("sumIncome").textContent = CET.money(data.summary.totalIncome);
  document.getElementById("sumExpense").textContent = CET.money(data.summary.totalExpense);
  document.getElementById("sumBalance").textContent = CET.money(data.summary.balance);
  document.getElementById("sumSavings").textContent = CET.money(data.summary.monthlySavings);
  const box = document.getElementById("warnings");
  if (data.warnings.length) {
    box.classList.remove("hidden");
    box.innerHTML = data.warnings.map((item) => `<div>${CET.escape(item)}</div>`).join("");
  } else {
    box.classList.add("hidden");
    box.innerHTML = "";
  }
  drawCharts(data);
}

async function loadTransactions() {
  const params = new URLSearchParams({
    q: document.getElementById("searchBox").value,
    from: document.getElementById("filterFrom").value,
    to: document.getElementById("filterTo").value,
    type: document.getElementById("filterType").value,
    category: document.getElementById("filterCategory").value
  });
  const data = await CET.request(`/api/transactions?${params}`);
  const body = document.getElementById("txBody");
  const empty = document.getElementById("txEmpty");
  if (!data.transactions.length) {
    empty.classList.remove("hidden");
    body.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  window.txMap = Object.fromEntries(data.transactions.map((row) => [row.id, row]));
  body.innerHTML = data.transactions.map((row) => `
    <tr>
      <td>${CET.escape(row.date)}</td>
      <td><span class="badge ${row.type}">${CET.escape(row.type)}</span></td>
      <td>${CET.escape(row.category)}</td>
      <td>${CET.escape(row.description || "—")}</td>
      <td>${CET.money(row.amount)}</td>
      <td>${row.receipt_key ? `<button class="ghost tiny" data-view="${row.id}">View</button>` : "—"}</td>
      <td class="actions">
        <button class="ghost tiny" data-edit="${row.id}">Edit</button>
        <button class="ghost tiny" data-receipt="${row.id}">Receipt</button>
        <button class="danger tiny" data-del="${row.id}">Delete</button>
      </td>
    </tr>
  `).join("");
}

async function loadHistory() {
  const params = new URLSearchParams({
    from: document.getElementById("histFrom").value,
    to: document.getElementById("histTo").value
  });
  const data = await CET.request(`/api/transactions?${params}`);
  const body = document.getElementById("histBody");
  const empty = document.getElementById("histEmpty");
  if (!data.transactions.length) {
    empty.classList.remove("hidden");
    body.innerHTML = "";
    return;
  }
  empty.classList.add("hidden");
  body.innerHTML = data.transactions.map((row) => `
    <tr>
      <td>${CET.escape(row.date)}</td>
      <td>${CET.escape(row.type)}</td>
      <td>${CET.escape(row.category)}</td>
      <td>${CET.escape(row.description || "—")}</td>
      <td>${CET.money(row.amount)}</td>
    </tr>
  `).join("");
}

async function loadBudgets() {
  const month = document.getElementById("budgetMonth").value;
  const data = await CET.request(`/api/budgets?month=${encodeURIComponent(month)}`);
  const spentMap = {};
  (window.lastSummary && window.lastSummary.budgetCards || []).forEach((item) => {
    spentMap[item.category] = item;
  });
  document.getElementById("budgetList").innerHTML = data.budgets.map((row) => {
    const spent = (spentMap[row.category] && month === (window.lastSummary.summary.month) ? spentMap[row.category].spent : 0);
    const percent = row.amount > 0 ? Math.min(100, Math.round((spent / row.amount) * 100)) : 0;
    const over = row.amount > 0 && spent >= row.amount;
    return `
      <div class="budget-row">
        <strong>${CET.escape(row.category)}</strong>
        <div class="meter ${over ? "over" : ""}"><i style="width:${percent}%"></i></div>
        <input type="number" min="0" step="0.01" value="${row.amount}" data-budget="${CET.escape(row.category)}">
        <button class="ghost tiny" data-save-budget="${CET.escape(row.category)}">Save</button>
      </div>
    `;
  }).join("");
}

const modal = document.getElementById("txModal");
const txForm = document.getElementById("txForm");

function openModal(row) {
  document.getElementById("txNotice").textContent = "";
  document.getElementById("txId").value = row ? row.id : "";
  document.getElementById("txTitle").textContent = row ? "Edit transaction" : "Add transaction";
  document.getElementById("txType").value = row ? row.type : "expense";
  fillCategorySelect(document.getElementById("txCategory"), document.getElementById("txType").value, row ? row.category : "");
  document.getElementById("txAmount").value = row ? row.amount : "";
  document.getElementById("txDate").value = row ? row.date : new Date().toISOString().slice(0, 10);
  document.getElementById("txDesc").value = row ? row.description : "";
  document.getElementById("txReceipt").value = "";
  modal.classList.add("open");
}

document.getElementById("txType").addEventListener("change", (event) => {
  fillCategorySelect(document.getElementById("txCategory"), event.target.value);
});

document.getElementById("addBtn").addEventListener("click", () => openModal(null));
document.getElementById("cancelTx").addEventListener("click", () => modal.classList.remove("open"));

txForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const notice = document.getElementById("txNotice");
  notice.textContent = "";
  document.getElementById("txLoader").classList.add("on");
  const payload = {
    type: document.getElementById("txType").value,
    category: document.getElementById("txCategory").value,
    amount: document.getElementById("txAmount").value,
    date: document.getElementById("txDate").value,
    description: document.getElementById("txDesc").value
  };
  const id = document.getElementById("txId").value;
  try {
    const saved = id
      ? await CET.request(`/api/transactions/${id}`, { method: "PUT", body: payload })
      : await CET.request("/api/transactions", { method: "POST", body: payload });
    const file = document.getElementById("txReceipt").files[0];
    if (file) {
      const form = new FormData();
      form.append("receipt", file);
      await CET.request(`/api/receipts/${saved.transaction.id}`, { method: "POST", body: form });
    }
    modal.classList.remove("open");
    CET.toast("Transaction saved.");
    await refreshAll();
  } catch (error) {
    notice.textContent = error.message;
  } finally {
    document.getElementById("txLoader").classList.remove("on");
  }
});

document.getElementById("txBody").addEventListener("click", async (event) => {
  const edit = event.target.closest("[data-edit]");
  const del = event.target.closest("[data-del]");
  const receipt = event.target.closest("[data-receipt]");
  const view = event.target.closest("[data-view]");
  if (edit) {
    openModal(window.txMap[Number(edit.dataset.edit)]);
  }
  if (del) {
    if (!confirm("Delete this transaction?")) {
      return;
    }
    await CET.request(`/api/transactions/${del.dataset.del}`, { method: "DELETE" });
    CET.toast("Transaction deleted.");
    await refreshAll();
  }
  if (receipt) {
    document.getElementById("txId").value = receipt.dataset.receipt;
    document.getElementById("txReceipt").click();
    document.getElementById("txReceipt").onchange = async () => {
      const file = document.getElementById("txReceipt").files[0];
      if (!file) {
        return;
      }
      const form = new FormData();
      form.append("receipt", file);
      try {
        await CET.request(`/api/receipts/${receipt.dataset.receipt}`, { method: "POST", body: form });
        CET.toast("Receipt uploaded.");
        await loadTransactions();
      } catch (error) {
        CET.toast(error.message);
      }
      document.getElementById("txReceipt").onchange = null;
    };
  }
  if (view) {
    const data = await CET.request(`/api/receipts/${view.dataset.view}/url`);
    window.open(data.url, "_blank", "noopener");
  }
});

document.getElementById("budgetList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-save-budget]");
  if (!button) {
    return;
  }
  const category = button.dataset.saveBudget;
  const amount = document.querySelector(`[data-budget="${category}"]`).value;
  await CET.request("/api/budgets", {
    method: "PUT",
    body: { category, amount, month: document.getElementById("budgetMonth").value }
  });
  CET.toast(`${category} budget saved.`);
  await loadSummary();
  await loadBudgets();
});

["searchBox", "filterFrom", "filterTo", "filterType", "filterCategory"].forEach((id) => {
  document.getElementById(id).addEventListener("input", loadTransactions);
  document.getElementById(id).addEventListener("change", loadTransactions);
});
["histFrom", "histTo"].forEach((id) => {
  document.getElementById(id).addEventListener("change", loadHistory);
});
document.getElementById("budgetMonth").addEventListener("change", loadBudgets);

document.getElementById("exportBtn").addEventListener("click", async () => {
  const params = new URLSearchParams({
    from: document.getElementById("histFrom").value,
    to: document.getElementById("histTo").value
  });
  const res = await fetch(`/api/transactions/export?${params}`, { credentials: "same-origin" });
  if (!res.ok) {
    CET.toast("Could not export CSV.");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "expense-history.csv";
  link.click();
  URL.revokeObjectURL(url);
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await CET.request("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
});

function currentMonthInput() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function refreshAll() {
  await loadSummary();
  await loadTransactions();
  await loadHistory();
  await loadBudgets();
}

async function boot() {
  fillCategorySelect(document.getElementById("txCategory"), "expense");
  const filterCat = document.getElementById("filterCategory");
  filterCat.innerHTML = `<option value="">All categories</option>` + [...EXPENSE_CATEGORIES, "Salary"].map((item) => `<option>${item}</option>`).join("");
  document.getElementById("budgetMonth").value = currentMonthInput();
  try {
    await CET.loadCsrf();
    const me = await CET.request("/api/auth/me");
    CET.user = me.user;
    document.getElementById("hello").textContent = `Signed in as ${me.user.name} · ${me.user.email}`;
    await refreshAll();
  } catch (error) {
    window.location.href = "/";
  }
}

boot();
