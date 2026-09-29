/* =============================================================================
   expenses.js — Expense Tracker dashboard
   Handles: expense CRUD, pagination, AI categorisation, AI insight,
            premium purchase (Cashfree), leaderboard, session refresh.
   ============================================================================= */

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const form              = document.getElementById("expenseForm");
const addExpenseBtn     = document.getElementById("addExpenseBtn");
const tableBody         = document.getElementById("expenseTableBody");
const descriptionInput  = document.getElementById("description");
const aiSuggestion      = document.getElementById("aiSuggestion");
const pageSizeSelect    = document.getElementById("pageSizeSelect");
const paginationSummary = document.getElementById("paginationSummary");
const pageNavigation    = document.getElementById("pageNavigation");
const pageNumbers       = document.getElementById("pageNumbers");
const pageIndicator     = document.getElementById("pageIndicator");
const previousPageBtn   = document.getElementById("previousPageBtn");
const nextPageBtn       = document.getElementById("nextPageBtn");
const expenseListStatus = document.getElementById("expenseListStatus");
const totalExpenseEl    = document.getElementById("totalExpenseAmount");

// Premium UI
const premiumBadge      = document.getElementById("premiumBadge");
const buyPremiumBtn     = document.getElementById("buyPremiumBtn");
const premiumMsg        = document.getElementById("premiumMsg");
const upgradeCta        = document.getElementById("upgradeCta");
const premiumActiveMsg  = document.getElementById("premiumActiveMsg");
const reportLink        = document.getElementById("reportLink");

// AI insight UI
const insightBtn        = document.getElementById("insightBtn");
const insightResult     = document.getElementById("insightResult");

// Leaderboard UI
const leaderboardSection      = document.getElementById("leaderboardSection");
const leaderboardRefreshBtn   = document.getElementById("leaderboardRefreshBtn");
const leaderboardStatus       = document.getElementById("leaderboardStatus");
const leaderboardTableWrap    = document.getElementById("leaderboardTableWrap");
const leaderboardBody         = document.getElementById("leaderboardBody");
const myStats                 = document.getElementById("myStats");
const myRankEl                = document.getElementById("myRank");
const myTotalExpenseEl        = document.getElementById("myTotalExpense");
const myExpenseCountEl        = document.getElementById("myExpenseCount");

// Notification banner
const notificationBanner = document.getElementById("notificationBanner");

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
let loggedInUser = JSON.parse(
  localStorage.getItem("loggedInUser") ||
  localStorage.getItem("expenseTrackerUser") ||
  "null"
);
let authToken = localStorage.getItem("authToken") || localStorage.getItem("expenseTrackerToken");

if (!loggedInUser || !authToken) {
  window.location.href = "login.html";
}

function clearStoredAuth() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("expenseTrackerToken");
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("expenseTrackerUser");
}

function saveAuth(token, user) {
  authToken    = token;
  loggedInUser = user;
  localStorage.setItem("authToken",          token);
  localStorage.setItem("expenseTrackerToken", token);
  localStorage.setItem("loggedInUser",        JSON.stringify(user));
  localStorage.setItem("expenseTrackerUser",  JSON.stringify(user));
}

function authHeaders() {
  return authToken ? { "Authorization": `Bearer ${authToken}` } : {};
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------
let notifTimer = null;
function showNotification(message, type = "info") {
  // type: "info" | "success" | "error"
  notificationBanner.textContent = message;
  notificationBanner.className   = `notification-banner notification-${type}`;
  notificationBanner.hidden      = false;
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => { notificationBanner.hidden = true; }, 5000);
}

// ---------------------------------------------------------------------------
// Generic API helper
// ---------------------------------------------------------------------------
async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  let result = {};
  try { result = await response.json(); } catch { /* ignore non-JSON */ }
  if (response.status === 401) {
    clearStoredAuth();
    window.location.href = "login.html";
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) throw new Error(result.message || `Request failed (${response.status}).`);
  return result;
}

// ---------------------------------------------------------------------------
// Pagination state
// ---------------------------------------------------------------------------
const PAGE_SIZE_OPTIONS = [5, 10, 20, 30, 40];
const savedSize = Number(
  localStorage.getItem("expensesPerPage") || localStorage.getItem("expensePageSize")
);
let pageSize   = PAGE_SIZE_OPTIONS.includes(savedSize) ? savedSize : 10;
let currentPage = 1;
let pagination  = {
  currentPage: 1, pageSize, totalExpenses: 0,
  totalPages: 0, hasNextPage: false, hasPreviousPage: false
};
let isLoadingExpenses    = false;
let paginationReady      = false;
let expenseRequestSeq    = 0;
let currentExpenses      = [];

// ---------------------------------------------------------------------------
// AI category suggestion state
// ---------------------------------------------------------------------------
let predictedCategory    = null;
let predictedDescription = "";
let predictedSource      = "fallback";

// ---------------------------------------------------------------------------
// Premium state helpers
// ---------------------------------------------------------------------------
function isPremiumUser() {
  return Boolean(loggedInUser?.isPremium || loggedInUser?.ispremiumuser);
}

function updatePremiumUI() {
  const premium = isPremiumUser();
  if (premiumBadge)     premiumBadge.hidden     = !premium;
  if (upgradeCta)       upgradeCta.hidden       =  premium;
  if (premiumActiveMsg) premiumActiveMsg.hidden  = !premium;
}

// ---------------------------------------------------------------------------
// Render expense table
// ---------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderExpenses(expenses) {
  if (!expenses.length) {
    tableBody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;color:#888;padding:24px;">No expenses found. Add your first expense above.</td></tr>';
    return;
  }
  tableBody.innerHTML = expenses.map(exp => `
    <tr>
      <td data-label="Amount">₹${Number(exp.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      <td data-label="Description">${escapeHtml(exp.description)}</td>
      <td data-label="Category"><span class="category-chip">${escapeHtml(exp.category || "Other")}</span></td>
      <td data-label="Source"><span class="source-chip source-${escapeHtml(exp.categorySource || "fallback")}">${escapeHtml(exp.categorySource || "saved")}</span></td>
      <td data-label="Date">${formatDate(exp.createdAt)}</td>
      <td data-label="Actions">
        <button class="delete-button" data-expense-id="${escapeHtml(String(exp.id))}" type="button" aria-label="Delete expense">Delete</button>
      </td>
    </tr>
  `).join("");
}

// ---------------------------------------------------------------------------
// Render pagination controls
// ---------------------------------------------------------------------------
function renderPagination() {
  const { currentPage: page, pageSize: size, totalExpenses, totalPages } = pagination;
  const start = totalExpenses ? (page - 1) * size + 1 : 0;
  paginationSummary.textContent = totalExpenses
    ? `Showing ${start}–${Math.min(start + size - 1, totalExpenses)} of ${totalExpenses} expenses`
    : "Showing 0 expenses";
  pageIndicator.textContent = `Page ${page} of ${totalPages || 1}`;

  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const lastPage  = Math.min(totalPages, firstPage + 4);
  const visible   = [];
  if (firstPage > 1) { visible.push(1); if (firstPage > 2) visible.push(null); }
  for (let p = firstPage; p <= lastPage; p++) visible.push(p);
  if (lastPage < totalPages) { if (lastPage < totalPages - 1) visible.push(null); visible.push(totalPages); }

  pageNumbers.innerHTML = visible.map(p => p === null
    ? '<span class="page-ellipsis" aria-hidden="true">…</span>'
    : `<button type="button" data-page="${p}" aria-label="Page ${p}"${p === page ? ' aria-current="page"' : ""}${isLoadingExpenses ? " disabled" : ""}>${p}</button>`
  ).join("");

  pageNavigation.hidden     = !paginationReady || totalPages <= 1;
  pageSizeSelect.disabled   = isLoadingExpenses;
  previousPageBtn.disabled  = isLoadingExpenses || !pagination.hasPreviousPage;
  nextPageBtn.disabled      = isLoadingExpenses || !pagination.hasNextPage;
}

function updateTotalExpense(amount) {
  if (!totalExpenseEl) return;
  const sum = Number(amount) || 0;
  totalExpenseEl.textContent = `₹${sum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// Load expenses (paginated)
// ---------------------------------------------------------------------------
async function loadExpenses({ page = currentPage } = {}) {
  if (!loggedInUser?.email) return;
  const seq = ++expenseRequestSeq;
  isLoadingExpenses = true;
  expenseListStatus.textContent = "Loading expenses…";
  renderPagination();

  try {
    const result = await apiJson(`/api/expenses?page=${page}&limit=${pageSize}`, {
      headers: authHeaders()
    });
    if (seq !== expenseRequestSeq) return;
    if (!Array.isArray(result.expenses) || !result.pagination) {
      throw new Error("Invalid response from server.");
    }
    currentExpenses = result.expenses;
    pagination      = result.pagination;
    currentPage     = pagination.currentPage;
    pageSize        = pagination.pageSize;
    pageSizeSelect.value = String(pageSize);
    paginationReady = true;
    renderExpenses(currentExpenses);
    updateTotalExpense(result.totalAmount);
    expenseListStatus.textContent = "";
  } catch (err) {
    if (seq !== expenseRequestSeq) return;
    tableBody.innerHTML =
      `<tr><td colspan="6" style="text-align:center;color:#9a352d;padding:16px;">
        Unable to load expenses. <button class="pagination-retry" data-retry-expenses type="button">Retry</button>
      </td></tr>`;
    expenseListStatus.textContent = err.message;
    pageNavigation.hidden = true;
  } finally {
    if (seq === expenseRequestSeq) {
      isLoadingExpenses = false;
      renderPagination();
    }
  }
}

// ---------------------------------------------------------------------------
// Delete expense
// ---------------------------------------------------------------------------
async function deleteExpense(expenseId) {
  if (!window.confirm("Delete this expense?")) return;
  const btn = tableBody.querySelector(`[data-expense-id="${CSS.escape(String(expenseId))}"]`);
  if (btn) btn.disabled = true;
  try {
    await apiJson(`/api/expenses/${encodeURIComponent(expenseId)}`, {
      method: "DELETE",
      headers: authHeaders()
    });
    await loadExpenses({ page: currentPage });
  } catch (err) {
    if (btn) btn.disabled = false;
    showNotification(err.message, "error");
  }
}

// ---------------------------------------------------------------------------
// AI Category suggestion (debounced)
// ---------------------------------------------------------------------------
async function suggestCategory() {
  const desc = descriptionInput.value.trim();
  if (!desc) {
    predictedCategory    = null;
    predictedDescription = "";
    predictedSource      = "fallback";
    aiSuggestion.textContent = "AI category will appear here.";
    return;
  }
  aiSuggestion.textContent = "AI is thinking…";
  try {
    const result = await apiJson("/api/categorize-expense", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body:    JSON.stringify({ description: desc })
    });
    predictedCategory    = result.category;
    predictedDescription = desc;
    predictedSource      = result.source || "fallback";
    aiSuggestion.textContent = `Suggested: ${result.category}`;
  } catch (err) {
    aiSuggestion.textContent = "Could not suggest category.";
  }
}

let suggestionTimer;
descriptionInput.addEventListener("input", () => {
  clearTimeout(suggestionTimer);
  suggestionTimer = setTimeout(suggestCategory, 400);
});

// ---------------------------------------------------------------------------
// Add expense form submit
// ---------------------------------------------------------------------------
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (addExpenseBtn) { addExpenseBtn.disabled = true; addExpenseBtn.textContent = "Adding…"; }

  const desc      = descriptionInput.value.trim();
  const useAiCat  = predictedDescription === desc && predictedCategory;

  const payload = {
    amount:         document.getElementById("amount").value,
    description:    desc,
    category:       useAiCat ? predictedCategory    : null,
    categorySource: useAiCat ? predictedSource      : null
  };

  try {
    const result = await apiJson("/api/expenses", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body:    JSON.stringify(payload)
    });
    form.reset();
    predictedCategory = null; predictedDescription = ""; predictedSource = "fallback";
    aiSuggestion.textContent = "AI category will appear here.";
    if (result && result.id) await loadExpenses({ page: 1 });
    showNotification("Expense added successfully.", "success");
  } catch (err) {
    showNotification(err.message, "error");
  } finally {
    if (addExpenseBtn) { addExpenseBtn.disabled = false; addExpenseBtn.textContent = "Add expense"; }
  }
});

// ---------------------------------------------------------------------------
// Table click delegation (delete + retry)
// ---------------------------------------------------------------------------
tableBody.addEventListener("click", (e) => {
  if (e.target.closest("[data-retry-expenses]")) {
    loadExpenses().catch(err => showNotification(err.message, "error"));
    return;
  }
  const delBtn = e.target.closest("[data-expense-id]");
  if (delBtn) deleteExpense(delBtn.dataset.expenseId).catch(err => showNotification(err.message, "error"));
});

// ---------------------------------------------------------------------------
// Pagination controls
// ---------------------------------------------------------------------------
pageSizeSelect.value = String(pageSize);
pageSizeSelect.addEventListener("change", () => {
  const selected = Number(pageSizeSelect.value);
  if (isLoadingExpenses || !PAGE_SIZE_OPTIONS.includes(selected)) return;
  pageSize = selected;
  localStorage.setItem("expensesPerPage", String(pageSize));
  currentPage = 1;
  loadExpenses({ page: 1 });
});

previousPageBtn.addEventListener("click", () => {
  if (!isLoadingExpenses && pagination.hasPreviousPage) loadExpenses({ page: currentPage - 1 });
});
nextPageBtn.addEventListener("click", () => {
  if (!isLoadingExpenses && pagination.hasNextPage) loadExpenses({ page: currentPage + 1 });
});
pageNumbers.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-page]");
  const p   = Number(btn?.dataset.page);
  if (!isLoadingExpenses && Number.isInteger(p) && p >= 1 && p <= pagination.totalPages) loadExpenses({ page: p });
});

// ---------------------------------------------------------------------------
// Session refresh — sync premium status from server on page load
// ---------------------------------------------------------------------------
async function refreshSession() {
  if (!authToken) return;
  try {
    const data = await apiJson("/api/auth/me", { headers: authHeaders() });
    if (data.user) {
      loggedInUser = { ...loggedInUser, ...data.user };
      localStorage.setItem("loggedInUser",       JSON.stringify(loggedInUser));
      localStorage.setItem("expenseTrackerUser",  JSON.stringify(loggedInUser));
      updatePremiumUI();
    }
  } catch {
    // If the session check fails for reasons other than 401, stay logged in.
  }
}

// ---------------------------------------------------------------------------
// AI Insight
// ---------------------------------------------------------------------------
insightBtn.addEventListener("click", async () => {
  insightBtn.disabled     = true;
  insightBtn.textContent  = "Analysing…";
  insightResult.hidden    = true;

  try {
    const data = await apiJson("/api/ai/insight", { headers: authHeaders() });
    insightResult.innerHTML = `
      <p class="insight-text">✨ ${escapeHtml(data.insight || data.message || "No insight available.")}</p>
      ${data.tip ? `<p class="insight-tip">💡 <em>${escapeHtml(data.tip)}</em></p>` : ""}
      <p class="insight-source">Source: ${escapeHtml(data.source || "local")}</p>
    `;
    insightResult.hidden = false;
  } catch (err) {
    insightResult.innerHTML = `<p class="insight-text" style="color:#9a352d;">⚠️ ${escapeHtml(err.message)}</p>`;
    insightResult.hidden    = false;
  } finally {
    insightBtn.disabled    = false;
    insightBtn.textContent = "✨ Get AI Insight";
  }
});

// ---------------------------------------------------------------------------
// Leaderboard
// ---------------------------------------------------------------------------
function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

async function loadLeaderboard() {
  leaderboardRefreshBtn.disabled = true;
  leaderboardStatus.textContent  = "Loading leaderboard…";
  leaderboardTableWrap.hidden    = true;
  myStats.hidden                 = true;

  try {
    const data = await apiJson("/api/leaderboard", { headers: authHeaders() });
    const rows = Array.isArray(data.leaderboard) ? data.leaderboard : [];

    if (!rows.length) {
      leaderboardStatus.textContent = "No data available yet.";
      return;
    }

    leaderboardBody.innerHTML = rows.map(row => `
      <tr class="${row.isCurrentUser ? "current-user-row" : ""}">
        <td data-label="Rank">
          ${row.rank <= 3
            ? `<span class="rank-medal rank-${row.rank}">${["🥇","🥈","🥉"][row.rank - 1]}</span>`
            : `<span class="rank-number">#${row.rank}</span>`}
        </td>
        <td data-label="Name">
          <strong>${escapeHtml(row.name)}</strong>
          ${row.isCurrentUser ? ' <span class="you-badge">You</span>' : ""}
        </td>
        <td data-label="Total Spent">${formatCurrency(row.totalExpense)}</td>
        <td data-label="Transactions">${row.expenseCount}</td>
      </tr>
    `).join("");

    leaderboardTableWrap.hidden = false;

    const mine = rows.find(r => r.isCurrentUser);
    if (mine) {
      myRankEl.textContent         = `#${mine.rank}`;
      myTotalExpenseEl.textContent = formatCurrency(mine.totalExpense);
      myExpenseCountEl.textContent = String(mine.expenseCount);
      myStats.hidden               = false;
    }

    leaderboardStatus.textContent = "";
  } catch (err) {
    leaderboardStatus.textContent = `Unable to load leaderboard: ${err.message}`;
  } finally {
    leaderboardRefreshBtn.disabled = false;
  }
}

leaderboardRefreshBtn.addEventListener("click", () => loadLeaderboard());

// Lazy-load leaderboard when it scrolls into view.
if ("IntersectionObserver" in window) {
  const obs = new IntersectionObserver((entries, observer) => {
    if (entries.some(e => e.isIntersecting)) {
      loadLeaderboard();
      observer.disconnect();
    }
  }, { rootMargin: "160px" });
  obs.observe(leaderboardSection);
} else {
  loadLeaderboard();
}

// ---------------------------------------------------------------------------
// Premium Purchase — Cashfree Checkout
// ---------------------------------------------------------------------------
buyPremiumBtn.addEventListener("click", purchasePremium);

async function purchasePremium() {
  if (isPremiumUser()) return;

  buyPremiumBtn.disabled    = true;
  buyPremiumBtn.textContent = "Creating order…";
  if (premiumMsg) premiumMsg.textContent = "";

  try {
    // Step 1: Create order on backend.
    const order = await apiJson("/api/purchase/premium", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() }
    });

    if (order.mode === "sandbox_simulation") {
      // No real Cashfree credentials — use confirm() simulation.
      await runSandboxSimulation(order);
    } else {
      // Real Cashfree credentials — open Cashfree Drop-in checkout.
      await runCashfreeCheckout(order);
    }
  } catch (err) {
    showNotification(err.message || "Payment failed. Please try again.", "error");
    if (premiumMsg) premiumMsg.textContent = err.message;
  } finally {
    buyPremiumBtn.disabled    = false;
    buyPremiumBtn.textContent = "⭐ Buy Premium — ₹199";
  }
}

// ---------- Cashfree JS SDK Drop-in checkout ----------
async function runCashfreeCheckout(order) {
  // Cashfree v3 exposes a factory rather than a mutable global checkout
  // object. Keep the secret server-side; the browser receives only a session.
  if (typeof Cashfree !== "function") {
    throw new Error("Cashfree SDK not loaded. Please refresh the page.");
  }

  const cfEnv   = order.cashfree_env === "production" ? "production" : "sandbox";
  const cfClient = Cashfree({ mode: cfEnv });
  const result = await cfClient.checkout({
    paymentSessionId: order.payment_session_id,
    redirectTarget: "_modal"
  });

  if (result?.error || result?.paymentDetails?.paymentStatus === "FAILED") {
    await notifyBackendFailed(order.order_id);
    throw new Error(result?.error?.message || "Payment failed or was cancelled.");
  }

  await verifyAndActivate(order.order_id);
}

// ---------- Sandbox simulation (no real credentials) ----------
async function runSandboxSimulation(order) {
  const paid = window.confirm(
    `Cashfree Sandbox Simulation\n\n` +
    `Order ID : ${order.order_id}\n` +
    `Amount   : ₹${Number(order.amount || 199).toFixed(2)}\n\n` +
    `Click OK to simulate a successful payment.\n` +
    `Click Cancel to simulate a failed payment.`
  );

  if (paid) {
    await verifyAndActivate(order.order_id, true);
  } else {
    await notifyBackendFailed(order.order_id);
  }
}

// Ask backend to verify payment status with Cashfree (or honour testSuccess in sim mode).
async function verifyAndActivate(orderId, testSuccess = false) {
  buyPremiumBtn.textContent = "Verifying payment…";
  if (premiumMsg) premiumMsg.textContent = "Verifying payment…";

  const result = await apiJson("/api/purchase/update-status", {
    method:  "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body:    JSON.stringify({ orderId, status: "SUCCESSFUL", testSuccess })
  });

  if (!result.success) {
    throw new Error(result.message || "Payment verification failed.");
  }

  // Update local auth state with the fresh premium JWT.
  if (result.token) {
    saveAuth(result.token, result.user || { ...loggedInUser, isPremium: true, ispremiumuser: true });
  } else {
    loggedInUser = { ...loggedInUser, isPremium: true, ispremiumuser: true };
    localStorage.setItem("loggedInUser",      JSON.stringify(loggedInUser));
    localStorage.setItem("expenseTrackerUser", JSON.stringify(loggedInUser));
  }

  updatePremiumUI();
  alert("Transaction Successful");
  showNotification("🎉 You are a Premium User Now", "success");
  if (premiumMsg) premiumMsg.textContent = "🎉 You are a Premium User Now";
}

async function notifyBackendFailed(orderId) {
  try {
    await apiJson("/api/purchase/update-status", {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body:    JSON.stringify({ orderId, status: "FAILED", testSuccess: false })
    });
  } catch { /* ignore */ }
  alert("TRANSACTION FAILED");
}

async function resumePaymentFromReturn() {
  const orderId = new URLSearchParams(window.location.search).get("order_id");
  if (!orderId || !authToken) return;

  try {
    const result = await apiJson(`/api/purchase/status/${encodeURIComponent(orderId)}`, {
      headers: authHeaders()
    });
    if (result.success && result.token) {
      saveAuth(result.token, result.user || { ...loggedInUser, isPremium: true, ispremiumuser: true });
      updatePremiumUI();
      showNotification("🎉 Premium payment verified successfully.", "success");
    } else if (result.gatewayStatus === "PENDING") {
      showNotification("Payment is still being confirmed by Cashfree.", "info");
    }
  } catch (err) {
    showNotification(err.message, "error");
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.delete("order_id");
    url.searchParams.delete("order_token");
    window.history.replaceState({}, document.title, url.pathname + url.search);
  }
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearStoredAuth();
    window.location.href = "login.html";
  });
}

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
updatePremiumUI();
renderPagination();

refreshSession().finally(() => {
  updatePremiumUI();
  resumePaymentFromReturn();
  loadExpenses();
});
