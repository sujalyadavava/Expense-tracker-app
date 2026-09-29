/* =============================================================================
   report.js — Expense Report page
   Handles: period tabs, date picker, client-side filtering, KPI display,
            CSV/PDF download (premium-gated, server-side generation).
   Security: never sends userId from frontend — all server routes use req.user
             from the JWT, so only the logged-in user's expenses are accessible.
   ============================================================================= */

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const reportRows         = document.getElementById("reportRows");
const reportStatus       = document.getElementById("reportStatus");
const reportPeriodLabel  = document.getElementById("reportPeriodLabel");
const downloadCsvBtn     = document.getElementById("downloadCsvBtn");
const downloadPdfBtn     = document.getElementById("downloadPdfBtn");
const premiumNotice      = document.getElementById("premiumNotice");
const premiumBadge       = document.getElementById("premiumBadge");
const reportDateInput    = document.getElementById("reportDate");
const notificationBanner = document.getElementById("notificationBanner");
const periodButtons      = [...document.querySelectorAll("[data-period]")];
const totalExpenseEl     = document.getElementById("totalExpense");
const txCountEl          = document.getElementById("transactionCount");
const categoryCountEl    = document.getElementById("categoryCount");

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const authToken = localStorage.getItem("authToken") || localStorage.getItem("expenseTrackerToken");

if (!authToken) {
  window.location.href = "login.html";
}

function authHeaders() {
  return authToken ? { "Authorization": `Bearer ${authToken}` } : {};
}

function clearStoredAuth() {
  ["authToken","expenseTrackerToken","loggedInUser","expenseTrackerUser"].forEach(k => localStorage.removeItem(k));
}

// ---------------------------------------------------------------------------
// Notification helpers
// ---------------------------------------------------------------------------
let _notifTimer = null;
function showNotification(message, type = "info") {
  notificationBanner.textContent = message;
  notificationBanner.className   = `notification-banner notification-${type}`;
  notificationBanner.hidden      = false;
  clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => { notificationBanner.hidden = true; }, 5000);
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------
async function apiJson(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options.headers || {}) } });
  let result = {};
  try { result = await response.json(); } catch { /* non-JSON */ }
  if (response.status === 401) {
    clearStoredAuth();
    window.location.href = "login.html";
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) throw new Error(result.message || `Request failed (${response.status}).`);
  return result;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let expenses       = [];
let isPremium      = null;
let isLoading      = true;
let reportLoaded   = false;
let selectedPeriod = "daily";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function toDateInputValue(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getSelectedDate() {
  const v = reportDateInput.value;
  if (!v) return new Date();
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function getPeriodRange(period, anchor = new Date()) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  if (period === "daily") {
    end.setDate(end.getDate() + 1);
  } else if (period === "weekly") {
    start.setDate(start.getDate() - start.getDay());   // Sunday start
    end.setTime(start.getTime());
    end.setDate(end.getDate() + 7);
  } else if (period === "monthly") {
    start.setDate(1);
    end.setTime(start.getTime());
    end.setMonth(end.getMonth() + 1);
  } else {  // yearly
    start.setMonth(0, 1);
    end.setTime(start.getTime());
    end.setFullYear(end.getFullYear() + 1);
  }
  return { start, end };
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function buildPeriodLabel(period, range) {
  if (period === "daily")   return `Daily report · ${formatDate(range.start)}`;
  if (period === "weekly") {
    const lastDay = new Date(range.end); lastDay.setDate(lastDay.getDate() - 1);
    return `Weekly report · ${formatDate(range.start)} – ${formatDate(lastDay)}`;
  }
  if (period === "monthly") {
    return `Monthly report · ${new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(range.start)}`;
  }
  return `Yearly report · ${range.start.getFullYear()}`;
}


// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Render the report for the selected period
// ---------------------------------------------------------------------------
function renderReport() {
  const range  = getPeriodRange(selectedPeriod, getSelectedDate());
  reportPeriodLabel.textContent = buildPeriodLabel(selectedPeriod, range);

  periodButtons.forEach(btn => {
    btn.setAttribute("aria-pressed", String(btn.dataset.period === selectedPeriod));
    btn.disabled = isLoading;
  });
  reportDateInput.disabled = isLoading;

  // Get filter inputs
  const filterCat = document.getElementById("filterCategory")?.value || "";
  const filterSearch = document.getElementById("filterSearch")?.value?.trim().toLowerCase() || "";
  const filterStart = document.getElementById("filterStartDate")?.value;
  const filterEnd = document.getElementById("filterEndDate")?.value;

  // Filter to selected period and search criteria.
  const rows = expenses
    .map(exp => ({ exp, date: exp.date || exp.expenseDate || exp.createdAt ? new Date(exp.date || exp.expenseDate || exp.createdAt) : null }))
    .filter(({ exp, date }) => {
      if (!date || isNaN(date.getTime())) return false;
      if (filterStart && date < new Date(filterStart + "T00:00:00")) return false;
      if (filterEnd && date > new Date(filterEnd + "T23:59:59")) return false;
      if (!filterStart && !filterEnd) {
        if (date < range.start || date >= range.end) return false;
      }
      if (filterCat && exp.category !== filterCat) return false;
      if (filterSearch) {
        const descMatch = String(exp.description || "").toLowerCase().includes(filterSearch);
        const catMatch = String(exp.category || "").toLowerCase().includes(filterSearch);
        if (!descMatch && !catMatch) return false;
      }
      return true;
    })
    .sort((a, b) => b.date - a.date);

  // Expense-only summary: 4 KPIs.
  const totalExpense = rows.reduce((sum, { exp }) => sum + (Number(exp.amount) || 0), 0);
  const avgExpense = rows.length ? Math.round(totalExpense / rows.length) : 0;
  const highestExpense = rows.length ? Math.max(...rows.map(({ exp }) => Number(exp.amount) || 0)) : 0;

  if (totalExpenseEl) totalExpenseEl.textContent = formatCurrency(totalExpense);
  if (txCountEl) txCountEl.textContent = String(rows.length);
  const avgEl = document.getElementById("averageExpense");
  if (avgEl) avgEl.textContent = formatCurrency(avgExpense);
  const highEl = document.getElementById("highestExpense");
  if (highEl) highEl.textContent = formatCurrency(highestExpense);

  // Table rows.
  if (!rows.length) {
    reportRows.innerHTML = `<tr><td colspan="5" class="report-empty" style="padding: 32px; text-align: center; color: #aab4bb;">No expenses found for the selected filters.</td></tr>`;
  } else {
    reportRows.innerHTML = rows.map(({ exp, date }) => {
      const amt = Number(exp.amount) || 0;
      return `<tr>
        <td>${escapeHtml(formatDate(date))}</td>
        <td>${escapeHtml(exp.description)}</td>
        <td><span class="category-chip">${escapeHtml(exp.category || "Other")}</span></td>
        <td class="amount-cell">${escapeHtml(formatCurrency(amt))}</td>
        <td style="text-align: center;">
          <button type="button" style="padding: 4px 8px; background: transparent; border: 1px solid #39464e; border-radius: 4px; color: #f87171; cursor: pointer;" onclick="if(confirm('Delete this expense?')) { fetch('/api/expenses/' + encodeURIComponent('${exp.id}'), { method: 'DELETE', headers: authHeaders() }).then(() => loadExpenses()); }">Delete</button>
        </td>
      </tr>`;
    }).join("");
  }

  updateDownloadState();
}

// ---------------------------------------------------------------------------
// Download button state
// ---------------------------------------------------------------------------
function updateDownloadState() {
  const canDownload = isPremium && reportLoaded && !isLoading;
  downloadCsvBtn.disabled = !canDownload;
  downloadPdfBtn.disabled = !canDownload;

  const periodLabel = selectedPeriod[0].toUpperCase() + selectedPeriod.slice(1);
  downloadCsvBtn.textContent = `📥 Download ${periodLabel}_Report.csv`;
  downloadPdfBtn.textContent = `📄 Download ${periodLabel}_Report.pdf`;

  // Premium notice bar.
  if (premiumNotice) premiumNotice.hidden = isPremium !== false;
  if (premiumBadge)  premiumBadge.hidden  = !isPremium;
}

// ---------------------------------------------------------------------------
// Load all expenses + session
// ---------------------------------------------------------------------------
async function loadExpenses() {
  isLoading      = true;
  reportLoaded   = false;
  reportStatus.textContent = "Loading report…";
  updateDownloadState();

  try {
    // Parallel: fetch session (for premium status) + first page of expenses.
    const [session, firstPage] = await Promise.all([
      apiJson("/api/auth/me"),
      apiJson("/api/expenses?page=1&limit=40")
    ]);

    isPremium = session.user?.isPremium === true || session.user?.ispremiumuser === true;
    expenses  = Array.isArray(firstPage.expenses) ? [...firstPage.expenses] : [];

    // Fetch remaining pages sequentially. The report download endpoint still
    // re-queries the authenticated user's date range on the server, so this
    // browser copy is only for the on-screen preview.
    const totalPages = Number(firstPage.pagination?.totalPages) || 1;
    for (let page = 2; page <= totalPages; page++) {
      const result = await apiJson(`/api/expenses?page=${page}&limit=40`);
      if (!Array.isArray(result.expenses)) throw new Error("Invalid expenses response.");
      expenses.push(...result.expenses);
    }

    reportLoaded             = true;
    reportStatus.textContent = "";
  } catch (err) {
    reportLoaded             = false;
    reportStatus.textContent = err.message || "Unable to load report data.";
    reportRows.innerHTML = `<tr><td class="report-empty" colspan="4">Unable to load report data. Please try again.</td></tr>`;
  } finally {
    isLoading = false;
    renderReport();
  }
}

// ---------------------------------------------------------------------------
// Download (CSV or PDF) — server-side generation, premium-gated on server too
// ---------------------------------------------------------------------------
async function downloadReportFile(format, btn) {
  if (!isPremium || isLoading || !reportLoaded) return;

  const periodLabel = selectedPeriod[0].toUpperCase() + selectedPeriod.slice(1);
  const filename    = `${periodLabel}_Report.${format}`;
  const origText    = btn.textContent;
  btn.disabled      = true;
  btn.textContent   = `Preparing ${filename}…`;

  try {
    const params = new URLSearchParams({
      period: selectedPeriod,
      date:   reportDateInput.value || toDateInputValue(new Date()),
      format
    });

    const response = await fetch(`/api/expenses/report?${params.toString()}`, {
      headers: authHeaders()
    });

    if (response.status === 401) {
      clearStoredAuth();
      window.location.href = "login.html";
      return;
    }

    // The server returns JSON (not a file) if the period has no expenses.
    const contentType = response.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const json = await response.json();
      showNotification(json.message || "No data to download.", "error");
      return;
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Download failed (${response.status}).`);
    }

    const blob        = await response.blob();
    const disposition = response.headers.get("Content-Disposition") || "";
    const match       = disposition.match(/filename="([^"]+)"/i);
    const dlName      = match?.[1] || filename;

    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href     = url;
    link.download = dlName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 1000);

    showNotification(`${dlName} downloaded successfully.`, "success");
  } catch (err) {
    showNotification(err.message || "Download failed.", "error");
  } finally {
    btn.textContent = origText;
    updateDownloadState();
  }
}

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------
periodButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (isLoading) return;
    selectedPeriod = btn.dataset.period;
    renderReport();
  });
});

reportDateInput.addEventListener("change", () => {
  if (!isLoading) renderReport();
});

document.getElementById("filterStartDate")?.addEventListener("change", () => { if (!isLoading) renderReport(); });
document.getElementById("filterEndDate")?.addEventListener("change", () => { if (!isLoading) renderReport(); });
document.getElementById("filterCategory")?.addEventListener("change", () => { if (!isLoading) renderReport(); });
document.getElementById("filterSearch")?.addEventListener("input", () => { if (!isLoading) renderReport(); });
document.getElementById("clearFiltersBtn")?.addEventListener("click", () => {
  const cat = document.getElementById("filterCategory");
  const search = document.getElementById("filterSearch");
  const sDate = document.getElementById("filterStartDate");
  const eDate = document.getElementById("filterEndDate");
  if (cat) cat.value = "";
  if (search) search.value = "";
  if (sDate) sDate.value = "";
  if (eDate) eDate.value = "";
  renderReport();
});

downloadCsvBtn.addEventListener("click", () => downloadReportFile("csv", downloadCsvBtn));
downloadPdfBtn.addEventListener("click", () => downloadReportFile("pdf", downloadPdfBtn));

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------
reportDateInput.value = toDateInputValue(new Date());
loadExpenses();
