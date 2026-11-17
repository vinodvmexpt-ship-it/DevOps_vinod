const STORAGE_KEY = "pennywise-demo-v1";
const expenseCategories = ["Food & dining", "Transport", "Shopping", "Bills & utilities", "Health", "Other"];
const incomeCategories = ["Salary", "Freelance", "Investment", "Other income"];
const icons = { "Food & dining": "◒", "Transport": "↗", "Shopping": "◇", "Bills & utilities": "⌂", "Health": "✚", "Salary": "↙", "Freelance": "✳", "Investment": "↗", "Other": "·", "Other income": "·" };
const palette = ["#2b7056", "#a9c678", "#e8b186", "#9a92b1", "#e2e8de", "#78a6a0"];
const today = new Date();
const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
const dateInMonth = (day) => `${monthKey}-${String(day).padStart(2, "0")}`;
const seededTransactions = [
  { id: 1, type: "income", amount: 8500000, category: "Salary", account: "Everyday account", date: dateInMonth(1), note: "Monthly salary" },
  { id: 2, type: "expense", amount: 1850000, category: "Bills & utilities", account: "Everyday account", date: dateInMonth(2), note: "Apartment rent" },
  { id: 3, type: "expense", amount: 84500, category: "Food & dining", account: "Everyday account", date: dateInMonth(4), note: "Lunch with Maya" },
  { id: 4, type: "expense", amount: 32000, category: "Transport", account: "Cash wallet", date: dateInMonth(5), note: "Metro card top-up" },
  { id: 5, type: "expense", amount: 249900, category: "Shopping", account: "Everyday account", date: dateInMonth(7), note: "A new desk lamp" },
  { id: 6, type: "expense", amount: 126000, category: "Food & dining", account: "Everyday account", date: dateInMonth(9), note: "Groceries" },
  { id: 7, type: "expense", amount: 89900, category: "Bills & utilities", account: "Everyday account", date: dateInMonth(10), note: "Internet bill" },
  { id: 8, type: "expense", amount: 55000, category: "Health", account: "Everyday account", date: dateInMonth(12), note: "Pharmacy" },
  { id: 9, type: "expense", amount: 68000, category: "Food & dining", account: "Everyday account", date: dateInMonth(14), note: "Coffee & pastries" },
  { id: 10, type: "income", amount: 1200000, category: "Freelance", account: "Savings account", date: dateInMonth(16), note: "Design project" },
];
const defaultBudgets = [
  { category: "Food & dining", amount: 1200000 }, { category: "Transport", amount: 500000 },
  { category: "Shopping", amount: 800000 }, { category: "Bills & utilities", amount: 2500000 },
  { category: "Health", amount: 400000 },
];
const defaultGoals = [
  { name: "Japan trip", target: 12000000, saved: 6780000, date: "Dec 2026", icon: "✈" },
  { name: "Rainy day fund", target: 20000000, saved: 8400000, date: "Mar 2027", icon: "☂" },
];

function freshState() {
  return {
    transactions: seededTransactions.map(transaction => ({ ...transaction })),
    budgets: defaultBudgets.map(budget => ({ ...budget })),
    goals: defaultGoals.map(goal => ({ ...goal })),
  };
}

let state = loadState();
let activePage = "dashboard";
let selectedType = "expense";
let activeMonth = monthKey;
let editingId = null;
let toastTimer;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.transactions)) return { transactions: parsed.transactions, budgets: parsed.budgets || defaultBudgets, goals: parsed.goals || defaultGoals };
    }
  } catch (error) {
    console.warn("Local demo data could not be loaded.", error);
  }
  return freshState();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Local demo data could not be saved.", error);
    showToast("Couldn't save changes in this browser.");
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function money(value) {
  const minorUnits = Math.round(Number(value));
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minorUnits / 100);
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function transactionsForMonth(month = activeMonth) {
  return state.transactions.filter((transaction) => transaction.date.startsWith(month));
}

function totals(transactions = transactionsForMonth()) {
  return transactions.reduce((result, transaction) => {
    result[transaction.type] += Number(transaction.amount);
    return result;
  }, { income: 0, expense: 0 });
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><span class="eyebrow">YOUR MONEY, IN PERSPECTIVE</span><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function monthControl() {
  const options = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return `<option value="${key}" ${key === activeMonth ? "selected" : ""}>${date.toLocaleString("en-IN", { month: "long", year: "numeric" })}</option>`;
  }).join("");
  return `<select class="month-select" id="month-select" aria-label="Select month">${options}</select>`;
}

function selectedMonthLabel() {
  const [year, month] = activeMonth.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function summaryCard(label, value, note, icon, variant = "") {
  return `<article class="summary-card"><div class="summary-top">${label}<span class="metric-icon ${variant}">${icon}</span></div><div class="summary-value">${money(value)}</div><div class="summary-foot">${note}</div></article>`;
}

function budgetUsed(category) {
  return transactionsForMonth().filter((transaction) => transaction.type === "expense" && transaction.category === category).reduce((sum, transaction) => sum + Number(transaction.amount), 0);
}

function budgetRow(budget) {
  const used = budgetUsed(budget.category);
  const percent = budget.amount ? Math.min((used / budget.amount) * 100, 100) : 0;
  const status = percent >= 100 ? "over" : percent >= 80 ? "warning" : "";
  return `<div class="budget-item"><div class="budget-meta"><strong>${escapeHTML(budget.category)}</strong><span>${money(used)} <b>/ ${money(budget.amount)}</b></span></div><div class="progress-track" role="progressbar" aria-label="${escapeHTML(budget.category)} budget used" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill ${status}" style="width:${percent}%"></div></div></div>`;
}

function categoryTotals(transactions) {
  const result = {};
  transactions.filter((transaction) => transaction.type === "expense").forEach((transaction) => {
    result[transaction.category] = (result[transaction.category] || 0) + Number(transaction.amount);
  });
  return Object.entries(result).sort((a, b) => b[1] - a[1]);
}

function categoryPanel() {
  const categories = categoryTotals(transactionsForMonth());
  const expenseTotal = categories.reduce((sum, category) => sum + category[1], 0);
  const top = categories.slice(0, 5);
  const total = top.reduce((sum, category) => sum + category[1], 0) || 1;
  let cursor = 0;
  const slices = top.map((category, index) => {
    const start = cursor;
    cursor += (category[1] / total) * 100;
    return `${palette[index % palette.length]} ${start}% ${cursor}%`;
  });
  const chartBackground = slices.length ? `conic-gradient(${slices.join(", ")})` : "#e2e8de";
  return `<section class="panel"><div class="panel-heading"><div><h2>Spending by category</h2><p class="panel-subtitle">A little look at where it goes</p></div><button class="text-link" data-page="reports">View report ↗</button></div><div class="category-layout"><div class="donut-chart" style="background:${chartBackground}" role="img" aria-label="Spending by category chart"><div class="donut-center"><strong>${money(expenseTotal)}</strong><span>total spent</span></div></div><div class="category-legend">${top.length ? top.map((item, index) => `<div class="category-legend-row"><span class="cat-dot" style="background:${palette[index % palette.length]}"></span>${escapeHTML(item[0])}<strong>${Math.round(item[1] / total * 100)}%</strong></div>`).join("") : `<span class="panel-subtitle">Add expenses to see your breakdown.</span>`}</div></div></section>`;
}

function trendPanel() {
  const offsets = [0, 1, 2, 3, 4, 5].map((offset) => {
    const date = new Date(today.getFullYear(), today.getMonth() - (5 - offset), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const total = totals(transactionsForMonth(key));
    return { label: date.toLocaleString("en", { month: "short" }), income: total.income, expense: total.expense };
  });
  const max = Math.max(1, ...offsets.flatMap((item) => [item.income, item.expense]));
  const point = (value, index) => `${42 + index * 64},${111 - value / max * 83}`;
  const incomePoints = offsets.map((item, index) => point(item.income, index)).join(" ");
  const expensePoints = offsets.map((item, index) => point(item.expense, index)).join(" ");
  const current = totals();
  const months = offsets.map((item, index) => `<text class="chart-label" x="${42 + index * 64}" y="132" text-anchor="middle">${item.label}</text>`).join("");
  return `<section class="panel"><div class="panel-heading"><div><h2>Money in & out</h2><p class="panel-subtitle">The last 6 months at a glance</p></div><button class="text-link" data-page="reports">Full report ↗</button></div><div class="chart-legend"><span><i class="legend-dot"></i>Income</span><span><i class="legend-dot expenses"></i>Expenses</span></div><svg class="trend-chart" viewBox="0 0 390 140" role="img" aria-label="Income and expenses over the last six months"><defs><linearGradient id="income-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#dcebe1" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs><line class="chart-gridline" x1="25" y1="34" x2="370" y2="34"/><line class="chart-gridline" x1="25" y1="74" x2="370" y2="74"/><line class="chart-gridline" x1="25" y1="113" x2="370" y2="113"/><polygon class="chart-area" points="42,111 ${incomePoints} 362,111"/><polyline class="chart-line-income" points="${incomePoints}"/><polyline class="chart-line-expenses" points="${expensePoints}"/>${offsets.map((item, index) => `<circle class="chart-point" cx="${42 + index * 64}" cy="${111 - item.income / max * 83}" r="3"/>`).join("")}${months}</svg><div class="trend-summary"><div><span>This month's income</span><strong>${money(current.income)}</strong></div><div><span>This month's spending</span><strong>${money(current.expense)}</strong></div></div></section>`;
}

function transactionRows(transactions, limit = 5) {
  return [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, limit).map((transaction) => {
    const icon = icons[transaction.category] || "·";
    const note = transaction.note || transaction.category;
    return `<div class="transaction-row"><div class="transaction-icon ${transaction.type}">${icon}</div><div class="transaction-copy"><strong>${escapeHTML(note)}</strong><span>${escapeHTML(transaction.category)} · ${escapeHTML(transaction.account)}</span></div><span class="transaction-amount ${transaction.type}">${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</span><span class="transaction-day">${formatDate(transaction.date)}</span></div>`;
  }).join("") || `<div class="empty-state">No transactions here yet. Add one to get started.</div>`;
}

function goalCard(goal, compact = false) {
  const percent = goal.target ? Math.min(goal.saved / goal.target * 100, 100) : 0;
  const progress = `<div class="progress-track goal-progress" role="progressbar" aria-label="${escapeHTML(goal.name)} progress" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="width:${percent}%"></div></div>`;
  if (compact) return `<div class="goal-card"><div class="goal-top"><div><div class="goal-name">${goal.icon} &nbsp;${escapeHTML(goal.name)}</div><div class="goal-date">Target · ${escapeHTML(goal.date)}</div></div><span class="goal-badge">${Math.round(percent)}%</span></div>${progress}<div class="goal-bottom"><span>${money(goal.saved)} saved</span><strong>${money(goal.target)}</strong></div></div>`;
  return `<article class="goal-page-card"><div class="goal-top"><div><h3>${goal.icon} &nbsp;${escapeHTML(goal.name)}</h3><div class="goal-date">Target date · ${escapeHTML(goal.date)}</div></div><span class="goal-badge">${Math.round(percent)}% saved</span></div>${progress}<div class="goal-bottom"><span>${money(goal.saved)} saved</span><strong>${money(goal.target)} goal</strong></div></article>`;
}

function dashboard() {
  const sums = totals();
  const savings = sums.income - sums.expense;
  const budgetSum = state.budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const budgetSpent = state.budgets.reduce((sum, budget) => sum + budgetUsed(budget.category), 0);
  const bills = [
    { name: "Electricity bill", date: "Due in 3 days", amount: 185000 },
    { name: "Music subscription", date: "Due in 8 days", amount: 19900 },
  ];
  return `${heading(`Good morning, Alex <span aria-hidden="true">✳</span>`, "Here's your financial snapshot for the month.", `${monthControl()}<button class="button button-primary quick-add" data-action="add">＋ &nbsp;Add transaction</button>`)}
    <section class="summary-grid" aria-label="Monthly summary">
      ${summaryCard("Total income", sums.income, `<span class="positive">↗</span> This month`, "↙")}
      ${summaryCard("Total expenses", sums.expense, `<span>Across ${new Set(transactionsForMonth().filter(t => t.type === "expense").map(t => t.category)).size} categories</span>`, "↗", "orange")}
      ${summaryCard("Net savings", savings, `<span class="${savings >= 0 ? "positive" : "negative"}">${savings >= 0 ? "Looking good" : "A little over income"}</span> this month`, "◎", "lilac")}
      ${summaryCard("Budget remaining", Math.max(budgetSum - budgetSpent, 0), `<span>${Math.round(budgetSum ? budgetSpent / budgetSum * 100 : 0)}%</span> of monthly limit used`, "◉")}
    </section>
    <div class="dashboard-grid">
      <div class="column-stack">${trendPanel()}${categoryPanel()}
        <section class="panel transactions-panel"><div class="panel-heading"><div><h2>Recent transactions</h2><p class="panel-subtitle">Your latest money moves</p></div><button class="text-link" data-page="transactions">All transactions ↗</button></div><div class="transaction-list">${transactionRows(transactionsForMonth())}</div></section>
      </div>
      <div class="column-stack">
        <section class="panel"><div class="panel-heading"><div><h2>Monthly budgets</h2><p class="panel-subtitle">Small steps, steady progress</p></div><button class="text-link" data-page="budgets">See all ↗</button></div><div class="budget-list">${state.budgets.slice(0, 4).map(budgetRow).join("")}</div><div class="budget-footer"><span>Total planned</span><strong>${money(budgetSum)}</strong></div></section>
        <section class="panel"><div class="panel-heading"><div><h2>Upcoming bills</h2><p class="panel-subtitle">A heads-up, so there are no surprises</p></div><button class="text-link" data-page="transactions">See all ↗</button></div><div class="transaction-list">${bills.map(bill => `<div class="transaction-row"><div class="transaction-icon">⌂</div><div class="transaction-copy"><strong>${bill.name}</strong><span>${bill.date}</span></div><span class="transaction-amount expense">${money(bill.amount)}</span></div>`).join("")}</div></section>
        <section class="panel"><div class="panel-heading"><div><h2>Your savings goals</h2><p class="panel-subtitle">You're making it happen</p></div><button class="text-link" data-page="goals">All goals ↗</button></div><div class="column-stack">${state.goals.slice(0, 2).map(goal => goalCard(goal, true)).join("")}</div></section>
      </div>
    </div>`;
}

function transactionsPage() {
  const rows = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  return `${heading("Transactions", "Every little thing adds up. Find it all right here.", `<button class="button button-quiet" data-action="export">↓ &nbsp;Export CSV</button><button class="button button-primary" data-action="add">＋ &nbsp;Add transaction</button>`)}
    <section class="panel"><div class="panel-heading"><div><h2>All transactions</h2><p class="panel-subtitle">${rows.length} entries · stored on this device</p></div><button class="text-link" data-action="import">Import CSV</button></div>
    <div class="table-toolbar"><input class="search-input" type="search" id="transaction-search" placeholder="Search notes or categories…" aria-label="Search transactions"><select class="filter-select" id="type-filter" aria-label="Filter by transaction type"><option value="">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select><select class="filter-select" id="category-filter" aria-label="Filter by category"><option value="">All categories</option>${[...expenseCategories, ...incomeCategories].map(category => `<option>${escapeHTML(category)}</option>`).join("")}</select><input class="filter-select" id="date-filter" type="month" aria-label="Filter by month"></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>TRANSACTION</th><th>DATE</th><th>ACCOUNT</th><th>CATEGORY</th><th style="text-align:right">AMOUNT</th><th></th></tr></thead><tbody id="transaction-table-body">${tableRows(rows)}</tbody></table></div></section>
    <input type="file" id="csv-file" accept=".csv,text/csv" hidden>`;
}

function tableRows(rows) {
  if (!rows.length) return `<tr><td colspan="6"><div class="empty-state">No matching transactions. Try another search or add one.</div></td></tr>`;
  return rows.map(transaction => `<tr><td><strong>${escapeHTML(transaction.note || transaction.category)}</strong><br><span class="panel-subtitle">${transaction.type === "income" ? "Income" : "Expense"}</span></td><td>${formatDate(transaction.date)}</td><td>${escapeHTML(transaction.account)}</td><td>${escapeHTML(transaction.category)}</td><td class="table-amount ${transaction.type === "income" ? "positive" : ""}">${transaction.type === "income" ? "+" : "−"}${money(transaction.amount)}</td><td class="row-actions"><button class="text-link" data-action="edit-transaction" data-id="${transaction.id}" aria-label="Edit transaction">Edit</button><button class="text-link delete-link" data-action="delete-transaction" data-id="${transaction.id}" aria-label="Delete transaction">Delete</button></td></tr>`).join("");
}

function budgetsPage() {
  const sum = state.budgets.reduce((total, budget) => total + budget.amount, 0);
  return `${heading("A plan for your spending", "Set a gentle limit for what matters to you.", `<button class="button button-primary" data-action="add-budget">＋ &nbsp;Add a budget</button>`)}
    <div class="budget-page-grid">${state.budgets.map(budget => {
      const used = budgetUsed(budget.category);
      const pct = budget.amount ? used / budget.amount * 100 : 0;
      return `<article class="budget-page-card"><div class="panel-heading"><div><h3>${escapeHTML(budget.category)}</h3><p class="panel-subtitle">Monthly budget</p></div><span class="metric-icon">${icons[budget.category] || "◉"}</span></div>${budgetRow(budget)}<div class="budget-footer"><span>${pct >= 100 ? "Over budget" : `${money(Math.max(budget.amount - used, 0))} left this month`}</span><strong>${Math.round(pct)}%</strong></div></article>`;
    }).join("")}</div><div class="info-banner">Your total planned budget is <strong>${money(sum)}</strong>. Progress updates as you add expenses. We'll gently flag categories when they reach 80%.</div>`;
}

function goalsPage() {
  return `${heading("Save for something lovely", "Big plans start with little steps.", `<button class="button button-primary" data-action="add-goal">＋ &nbsp;New savings goal</button>`)}<div class="goal-page-grid">${state.goals.map(goal => goalCard(goal)).join("") || `<div class="panel empty-state">No goals yet. Create one and give your savings a purpose.</div>`}</div><div class="info-banner">A goal is just a helpful target. There's no pressure to get there all at once.</div>`;
}

function reportsPage() {
  const sum = totals();
  const categories = categoryTotals(transactionsForMonth());
  return `${heading("Your monthly report", "A clear picture, with no judgement.", `${monthControl()}<button class="button button-quiet" data-action="export">↓ &nbsp;Export data</button>`)}
    <div class="report-stats"><div class="report-stat"><span>Money in</span><strong>${money(sum.income)}</strong></div><div class="report-stat"><span>Money out</span><strong>${money(sum.expense)}</strong></div><div class="report-stat"><span>Net savings</span><strong>${money(sum.income - sum.expense)}</strong></div></div>
    ${trendPanel()}    <section class="panel section-panel"><div class="panel-heading"><div><h2>Spending by category</h2><p class="panel-subtitle">For ${selectedMonthLabel()}</p></div><button class="button button-quiet button-small" data-action="export">Export CSV</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>CATEGORY</th><th>TRANSACTIONS</th><th style="text-align:right">TOTAL SPENT</th></tr></thead><tbody>${categories.map(([category, amount]) => `<tr><td>${escapeHTML(category)}</td><td>${transactionsForMonth().filter(t => t.category === category).length}</td><td class="table-amount">${money(amount)}</td></tr>`).join("") || `<tr><td colspan="3"><div class="empty-state">Add a few transactions to see your report.</div></td></tr>`}</tbody></table></div></section>`;
}

function settingsPage() {
  return `${heading("Settings", "Make Pennywise feel a little more like yours.")}<section class="panel"><div class="panel-heading"><div><h2>Preferences</h2><p class="panel-subtitle">Your choices are saved in this browser.</p></div></div><div class="settings-list">
    <div class="setting-row"><div><strong>Currency</strong><p>Used to display your amounts.</p></div><select class="filter-select" aria-label="Currency"><option>INR — ₹</option><option>USD — $</option><option>EUR — €</option><option>GBP — £</option></select></div>
    <div class="setting-row"><div><strong>Bill reminders</strong><p>See a heads-up for upcoming bills.</p></div><button class="toggle" role="switch" aria-checked="true" aria-label="Bill reminders"></button></div>
    <div class="setting-row"><div><strong>Budget reminders</strong><p>A gentle note when a budget is nearly used.</p></div><button class="toggle" role="switch" aria-checked="true" aria-label="Budget reminders"></button></div>
    <div class="setting-row"><div><strong>Your privacy</strong><p>Demo data is stored locally in this browser only. No account or bank connection is set up.</p></div></div>
    <div class="setting-row"><div><strong>Delete demo data</strong><p>Clear locally saved transactions and return to the sample view.</p></div><button class="button button-quiet button-small" data-action="clear-data">Clear data</button></div>
  </div></section><div class="info-banner">Pennywise is for keeping track of your money, not for financial, tax, or investment advice.</div>`;
}

function render() {
  const pages = { dashboard, transactions: transactionsPage, budgets: budgetsPage, goals: goalsPage, reports: reportsPage, settings: settingsPage };
  document.querySelector("#app-content").innerHTML = (pages[activePage] || dashboard)();
  document.querySelector("#page-crumb").textContent = ({ dashboard: "Overview", transactions: "Transactions", budgets: "Budgets", goals: "Savings goals", reports: "Reports", settings: "Settings" })[activePage];
  document.querySelectorAll(".nav-link[data-page]").forEach(link => link.classList.toggle("active", link.dataset.page === activePage));
  const monthSelect = document.querySelector("#month-select");
  if (monthSelect) monthSelect.addEventListener("change", (event) => {
    activeMonth = event.target.value;
    render();
  });
  document.querySelector("#sidebar").classList.remove("open");
}

function openModal() {
  const modal = document.querySelector("#modal-backdrop");
  modal.hidden = false;
  const dateInput = document.querySelector("#transaction-date");
  dateInput.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  updateCategoryOptions();
  document.querySelector("#amount").focus();
}

function closeModal() {
  document.querySelector("#modal-backdrop").hidden = true;
  document.querySelector("#transaction-form").reset();
  selectedType = "expense";
  editingId = null;
  document.querySelector("#modal-title").textContent = "Add a transaction";
  document.querySelectorAll(".type-option").forEach(button => button.classList.toggle("selected", button.dataset.type === selectedType));
}

function editTransaction(id) {
  const transaction = state.transactions.find(item => item.id === id);
  if (!transaction) return;
  editingId = id;
  selectedType = transaction.type;
  document.querySelector("#modal-title").textContent = "Edit transaction";
  document.querySelectorAll(".type-option").forEach(button => button.classList.toggle("selected", button.dataset.type === selectedType));
  updateCategoryOptions();
  document.querySelector("#amount").value = (transaction.amount / 100).toFixed(2);
  document.querySelector("#category").value = transaction.category;
  document.querySelector('[name="account"]').value = transaction.account;
  document.querySelector("#transaction-date").value = transaction.date;
  document.querySelector('[name="note"]').value = transaction.note || "";
  document.querySelector("#modal-backdrop").hidden = false;
  document.querySelector("#amount").focus();
}

function updateCategoryOptions() {
  const categories = selectedType === "income" ? incomeCategories : expenseCategories;
  document.querySelector("#category").innerHTML = categories.map(category => `<option>${escapeHTML(category)}</option>`).join("");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function exportCSV() {
  const csvEscape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const rows = [["Date", "Type", "Amount", "Category", "Account", "Note"], ...state.transactions.map(transaction => [transaction.date, transaction.type, (Number(transaction.amount) / 100).toFixed(2), transaction.category, transaction.account, transaction.note])];
  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "pennywise-transactions.csv";
  link.click();
  URL.revokeObjectURL(url);
  showToast("Your CSV export is ready.");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows.filter(csvRow => csvRow.some(cell => cell.trim()));
}

function importCSV(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCSV(String(reader.result || ""));
      if (rows.length < 2) throw new Error("The CSV doesn't contain any transaction rows.");
      const headers = rows[0].map(header => header.trim().toLowerCase());
      const find = (names) => names.map(name => headers.indexOf(name)).find(index => index >= 0);
      const dateIndex = find(["date"]);
      const amountIndex = find(["amount"]);
      const typeIndex = find(["type"]);
      const categoryIndex = find(["category"]);
      const accountIndex = find(["account"]);
      const noteIndex = find(["note", "description"]);
      if (dateIndex === undefined || amountIndex === undefined) throw new Error("Your CSV needs at least Date and Amount columns.");
      const imported = rows.slice(1).map((cells, index) => {
        const amount = Number(String(cells[amountIndex] || "").replace(/[₹,$\s]/g, ""));
        const date = String(cells[dateIndex] || "").trim();
        if (!Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Please check row ${index + 2}: use a positive amount and date in YYYY-MM-DD format.`);
        const type = typeIndex === undefined ? "expense" : String(cells[typeIndex]).toLowerCase().includes("income") ? "income" : "expense";
        const category = categoryIndex === undefined || !cells[categoryIndex] ? (type === "income" ? "Other income" : "Other") : cells[categoryIndex];
        return { id: Date.now() + index, type, amount: Math.round(amount * 100), date, category, account: (accountIndex === undefined ? "" : cells[accountIndex]) || "Everyday account", note: noteIndex === undefined ? "" : cells[noteIndex] };
      });
      const existing = new Set(state.transactions.map(transaction => `${transaction.date}|${transaction.amount}|${transaction.category}|${transaction.note}`));
      const unique = imported.filter(transaction => !existing.has(`${transaction.date}|${transaction.amount}|${transaction.category}|${transaction.note}`));
      state.transactions = [...unique, ...state.transactions];
      saveState();
      render();
      showToast(`${unique.length} transaction${unique.length === 1 ? "" : "s"} imported${unique.length < imported.length ? ` · ${imported.length - unique.length} duplicate${imported.length - unique.length === 1 ? "" : "s"} skipped` : ""}.`);
    } catch (error) {
      showToast(error.message || "That CSV couldn't be imported.");
    }
  };
  reader.onerror = () => showToast("Couldn't read that CSV file.");
  reader.readAsText(file);
}

document.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    activePage = pageButton.dataset.page;
    render();
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;
    if (action === "add") openModal();
    if (action === "export") exportCSV();
    if (action === "import") document.querySelector("#csv-file").click();
    if (action === "edit-transaction") editTransaction(Number(actionButton.dataset.id));
    if (action === "delete-transaction") {
      const id = Number(actionButton.dataset.id);
      if (confirm("Delete this transaction? This can't be undone.")) {
        state.transactions = state.transactions.filter(transaction => transaction.id !== id);
        saveState(); render(); showToast("Transaction deleted.");
      }
    }
    if (action === "add-budget") {
      const category = prompt("Which category would you like to budget for?");
      if (!category) return;
      const amount = Number(prompt(`Monthly limit for ${category} (₹):`));
      if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter a budget amount above zero."); return; }
      if (state.budgets.some(budget => budget.category.toLowerCase() === category.toLowerCase())) { showToast("There's already a budget for that category."); return; }
      state.budgets.push({ category, amount: Math.round(amount * 100) });
      saveState(); render(); showToast("Your budget is ready.");
    }
    if (action === "add-goal") {
      const name = prompt("What are you saving for?");
      if (!name) return;
      const target = Number(prompt(`What's your savings target for ${name}? (₹)`));
      if (!Number.isFinite(target) || target <= 0) { showToast("Enter a savings target above zero."); return; }
      state.goals.push({ name, target: Math.round(target * 100), saved: 0, date: "No date set", icon: "◎" });
      saveState(); render(); showToast("Your new goal is set.");
    }
    if (action === "clear-data" && confirm("Clear locally saved demo transactions? Your original sample data will return.")) {
      localStorage.removeItem(STORAGE_KEY); state = freshState(); render(); showToast("Sample data restored.");
    }
    return;
  }
  if (event.target.closest(".close-modal")) closeModal();
  if (event.target.id === "modal-backdrop") closeModal();
  if (event.target.classList.contains("type-option")) {
    selectedType = event.target.dataset.type;
    document.querySelectorAll(".type-option").forEach(button => button.classList.toggle("selected", button === event.target));
    updateCategoryOptions();
  }
  if (event.target.classList.contains("toggle")) {
    event.target.setAttribute("aria-checked", event.target.getAttribute("aria-checked") !== "true");
  }
});

document.addEventListener("submit", (event) => {
  if (event.target.id !== "transaction-form") return;
  event.preventDefault();
  const formData = new FormData(event.target);
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) { showToast("Enter an amount above zero."); return; }
  const transaction = {
    id: editingId ?? Date.now(), type: selectedType, amount: Math.round(amount * 100),
    category: formData.get("category"), account: formData.get("account"),
    date: formData.get("date"), note: String(formData.get("note") || "").trim(),
  };
  if (editingId === null) state.transactions.push(transaction);
  else state.transactions = state.transactions.map(item => item.id === editingId ? transaction : item);
  const wasEditing = editingId !== null;
  saveState();
  closeModal();
  render();
  showToast(wasEditing ? "Transaction updated." : "Transaction saved. Nice and easy.");
});

document.addEventListener("input", (event) => {
  if (!["transaction-search", "type-filter", "category-filter", "date-filter"].includes(event.target.id)) return;
  const search = (document.querySelector("#transaction-search")?.value || "").trim().toLowerCase();
  const type = document.querySelector("#type-filter")?.value || "";
  const category = document.querySelector("#category-filter")?.value || "";
  const month = document.querySelector("#date-filter")?.value || "";
  const filtered = state.transactions.filter(transaction =>
    (!search || `${transaction.note} ${transaction.category} ${transaction.account}`.toLowerCase().includes(search)) &&
    (!type || transaction.type === type) && (!category || transaction.category === category) && (!month || transaction.date.startsWith(month))
  ).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const body = document.querySelector("#transaction-table-body");
  if (body) body.innerHTML = tableRows(filtered);
});

document.addEventListener("change", (event) => {
  if (event.target.id === "csv-file" && event.target.files?.[0]) {
    importCSV(event.target.files[0]);
    event.target.value = "";
  }
});

document.querySelector("#menu-toggle").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#modal-backdrop").hidden) closeModal();
});
render();
