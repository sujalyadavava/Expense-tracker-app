const API = "/api";
const form = document.getElementById("form");
const msg = document.getElementById("msg");
const authScreen = document.getElementById("authScreen");
const trackerApp = document.getElementById("trackerApp");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authName = document.getElementById("authName");
const authNameLabel = document.getElementById("authNameLabel");
const authConfirmPassword = document.getElementById("authConfirmPassword");
const authConfirmPasswordLabel = document.getElementById("authConfirmPasswordLabel");
const forgotPasswordLink = document.getElementById("forgotPasswordLink");
const authMsg = document.getElementById("authMsg");
const authSubmit = document.getElementById("authSubmit");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const list = document.getElementById("list");
const total = document.getElementById("total");
const insight = document.getElementById("insight");
const insightBtn = document.getElementById("insightBtn");
const buyPremiumBtn = document.getElementById("buyPremiumBtn");
const premiumUserBadge = document.getElementById("premiumUserBadge");
const premiumBanner = document.getElementById("premiumBanner");
const amount = document.getElementById("amount");
const expenseDate = document.getElementById("expenseDate");
if (expenseDate && !expenseDate.value) expenseDate.value = new Date().toISOString().slice(0, 10);
const description = document.getElementById("description");
const category = document.getElementById("category");
const leaderboardRefresh = document.getElementById("leaderboardRefresh");
const leaderboardStatus = document.getElementById("leaderboardStatus");
const leaderboardSummary = document.getElementById("leaderboardSummary");
const leaderboardTableWrap = document.getElementById("leaderboardTableWrap");
const leaderboardBody = document.getElementById("leaderboardBody");
const myRank = document.getElementById("myRank");
const myTotalExpense = document.getElementById("myTotalExpense");
const myExpenseCount = document.getElementById("myExpenseCount");
const expensePageSizeSelect = document.getElementById("expensePageSize");
const expensePaginationSummary = document.getElementById("expensePaginationSummary");
const expensePageNavigation = document.getElementById("expensePageNavigation");
const expensePageNumbers = document.getElementById("expensePageNumbers");
const expensePageIndicator = document.getElementById("expensePageIndicator");
const expensePreviousPage = document.getElementById("expensePreviousPage");
const expenseNextPage = document.getElementById("expenseNextPage");
const expenseListStatus = document.getElementById("expenseListStatus");

const esc = x => { const d = document.createElement("div"); d.textContent = x; return d.innerHTML; };

async function request(path, options = {}) {
  const url = API + (path.startsWith("/api/") ? path.slice(4) : path);
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error("Unable to reach the backend. Check network connectivity.");
  }
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Backend returned an invalid response (${response.status}).`);
  }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

let authToken = localStorage.getItem("authToken") || localStorage.getItem("expenseTrackerToken");
let currentUser = JSON.parse(localStorage.getItem("loggedInUser") || localStorage.getItem("expenseTrackerUser") || "null");
let authMode = "login";
const expensePageSizes = [5, 10, 20, 30, 40];
const savedExpensePageSize = Number(localStorage.getItem("expensesPerPage") || localStorage.getItem("expensePageSize"));
let expensePageSize = expensePageSizes.includes(savedExpensePageSize) ? savedExpensePageSize : 10;
let expensePage = 1;
let expensePagination = { currentPage: 1, pageSize: expensePageSize, totalExpenses: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false };
let isLoadingExpenses = false;
let expensePaginationReady = false;
let expenseRequestSequence = 0;

function authHeaders() {
  const headers = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return headers;
}

function setAuth(data) {
  authToken = data.token;
  currentUser = data.user;
  localStorage.setItem("authToken", authToken);
  localStorage.setItem("expenseTrackerToken", authToken);
  localStorage.setItem("loggedInUser", JSON.stringify(currentUser));
  localStorage.setItem("expenseTrackerUser", JSON.stringify(currentUser));
  updatePremiumState();
  load();
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem("authToken");
  localStorage.removeItem("expenseTrackerToken");
  localStorage.removeItem("loggedInUser");
  localStorage.removeItem("expenseTrackerUser");
  updatePremiumState();
}

function updatePremiumState() {
  const isLogged = Boolean(currentUser);
  if (authScreen) authScreen.hidden = isLogged;
  if (trackerApp) trackerApp.hidden = !isLogged;
  const isPremium = Boolean(currentUser?.isPremium || currentUser?.ispremiumuser);
  // Buy button: visible only when logged in AND not yet premium
  if (buyPremiumBtn) buyPremiumBtn.hidden = !isLogged || isPremium;
  // Premium badge: visible only when logged in AND premium
  if (premiumUserBadge) premiumUserBadge.hidden = !isLogged || !isPremium;
  // Premium banner "🎉 You are a Premium User Now": visible when logged in AND premium
  if (premiumBanner) premiumBanner.hidden = !isLogged || !isPremium;

  const statMembership = document.getElementById("statMembership");
  const statSub = document.getElementById("statMembershipSub");
  if (statMembership) {
    statMembership.textContent = isPremium ? "👑 Premium" : "Free Tier";
    statMembership.className = isPremium ? "stat-value text-gold" : "stat-value";
  }
  if (statSub) statSub.textContent = isPremium ? "Full report downloads" : "Standard access";
}

async function buyPremiumMembership() {
  if (!buyPremiumBtn || !authToken || currentUser?.isPremium || currentUser?.ispremiumuser) return;
  buyPremiumBtn.disabled = true;
  buyPremiumBtn.textContent = "Creating order...";

  try {
    // Step 1: Create PENDING order on backend
    const order = await request("/api/purchase/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() }
    });

    let paid = false;

    if (order.mode === "sandbox_simulation") {
      // Sandbox: use confirm() to simulate pay / cancel
      paid = window.confirm(
        `Cashfree Sandbox Payment\n\nOrder: ${order.order_id}\nAmount: ₹${Number(order.amount || 199).toFixed(2)}\n\nPress OK to simulate a successful payment.\nPress Cancel to simulate a failed payment.`
      );
    } else {
      // Real Cashfree Drop-in checkout
      if (typeof Cashfree !== "function") throw new Error("Cashfree SDK not loaded. Please refresh.");
      const cashfreeClient = Cashfree({
        mode: order.cashfree_env === "production" ? "production" : "sandbox"
      });
      const checkoutResult = await cashfreeClient.checkout({
        paymentSessionId: order.payment_session_id,
        redirectTarget: "_modal"
      });
      paid = !checkoutResult?.error
        && checkoutResult?.paymentDetails?.paymentStatus !== "FAILED";
    }

    // Step 2: Notify backend of result
    const result = await request("/api/purchase/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        orderId: order.order_id,
        status: paid ? "SUCCESSFUL" : "FAILED",
        testSuccess: paid
      })
    });

    if (!paid || !result.success) {
      // Payment failed or cancelled
      window.alert("TRANSACTION FAILED");
      return;
    }

    // Step 3: Payment successful — update local auth state with fresh JWT
    if (result.token) {
      authToken = result.token;
      localStorage.setItem("authToken", authToken);
      localStorage.setItem("expenseTrackerToken", authToken);
    }
    currentUser = result.user || { ...currentUser, isPremium: true, ispremiumuser: true };
    localStorage.setItem("loggedInUser", JSON.stringify(currentUser));
    localStorage.setItem("expenseTrackerUser", JSON.stringify(currentUser));

    // Update UI: hide Buy button, show badge + banner
    updatePremiumState();

    // Show success alerts as specified
    window.alert("Transaction Successful");

  } catch (error) {
    window.alert(error.message || "TRANSACTION FAILED");
  } finally {
    if (buyPremiumBtn) {
      buyPremiumBtn.disabled = false;
      buyPremiumBtn.textContent = "⭐ Buy Premium Membership";
    }
  }
}

if (buyPremiumBtn) buyPremiumBtn.addEventListener("click", buyPremiumMembership);

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function renderLeaderboard(rows) {
  // Server already filters out test/dummy accounts (nitin, ansh, anki, @example.com, etc.)
  // and only allows prem9771190912@gmail.com for Prem-prefixed names.
  // Do NOT apply any extra client-side name filter here.
  const visibleRows = (Array.isArray(rows) ? rows : []);

  if (!visibleRows.length) {
    leaderboardTableWrap.hidden = true;
    leaderboardSummary.hidden = true;
    leaderboardStatus.textContent = "No users found.";
    return;
  }

  leaderboardBody.innerHTML = visibleRows.map((row) => {
    const isCurrentUser = Boolean(row.isCurrentUser);
    return `<tr class="${isCurrentUser ? "current-user" : ""}">
      <td data-label="Rank">#${row.rank}</td>
      <td data-label="User"><strong>${esc(row.name)}</strong>${isCurrentUser ? " <span class=\"you-badge\">You</span>" : ""}</td>
      <td data-label="Membership"><span class="membership-badge ${row.isPremium ? "premium-membership-badge" : "standard-membership-badge"}">${row.isPremium ? "👑 Premium" : "👤 Standard"}</span></td>
      <td data-label="Total Expense">${formatCurrency(row.totalExpense)}</td>
      <td data-label="Expenses">${row.expenseCount}</td>
    </tr>`;
  }).join("");

  const mine = visibleRows.find((row) => row.isCurrentUser);
  if (mine) {
    if (myRank) myRank.textContent = `#${mine.rank}`;
    if (myTotalExpense) myTotalExpense.textContent = formatCurrency(mine.totalExpense);
    if (myExpenseCount) myExpenseCount.textContent = String(mine.expenseCount);
    if (leaderboardSummary) leaderboardSummary.hidden = false;
    const statRank = document.getElementById("statCurrentRank");
    if (statRank) statRank.textContent = `#${mine.rank}`;
  }
  leaderboardTableWrap.hidden = false;
  leaderboardStatus.textContent = "Leaderboard updated.";
}

async function loadLeaderboard() {
  if (!currentUser || !leaderboardStatus) return;
  leaderboardRefresh.disabled = true;
  leaderboardStatus.textContent = "Loading leaderboard...";
  try {
    const data = await request("/api/leaderboard", { headers: authHeaders() });
    renderLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : []);
  } catch (error) {
    leaderboardTableWrap.hidden = true;
    leaderboardSummary.hidden = true;
    leaderboardStatus.textContent = "Unable to load leaderboard. Please try again.";
  } finally {
    leaderboardRefresh.disabled = false;
  }
}

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "register";
  if (authTitle) authTitle.textContent = signup ? "Create your account" : "Welcome back";
  if (authSubtitle) authSubtitle.textContent = signup ? "Start tracking your expenses" : "Sign in to continue to your expenses";
  if (authSubmit) authSubmit.textContent = signup ? "Create account" : "Login";
  if (registerBtn) registerBtn.textContent = signup ? "Back to login" : "Create a new account";
  if (authNameLabel) authNameLabel.hidden = !signup;
  if (authConfirmPasswordLabel) authConfirmPasswordLabel.hidden = !signup;
  if (forgotPasswordLink) forgotPasswordLink.hidden = signup;
  if (authMsg) authMsg.textContent = "";
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    clearAuth();
    if (authMsg) authMsg.textContent = "You have been logged out.";
  });
}

function formatReadableDate(rawDate) {
  if (!rawDate) return "—";
  const d = new Date(String(rawDate).length === 10 ? String(rawDate) + "T12:00:00" : rawDate);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function renderExpenseItem(x) {
  const d = document.createElement("div");
  d.className = "expense";
  d.dataset.expenseId = String(x.id);
  d.dataset.amount = String(Number(x.amount) || 0);
  const formattedDate = formatReadableDate(x.date || x.expenseDate || x.createdAt);
  d.innerHTML = `<div><b>${esc(x.description)}</b><div class="meta"><span class="cat">${esc(x.category)}</span>${x.aiSuggested ? '<span class="ai"> • AI suggested</span>' : ""} • 📅 ${formattedDate}</div></div><div><b>₹${(+x.amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <button class="del" onclick="del('${x.id}')">Delete</button></div>`;
  return d;
}

function updateTotalFromList(amount) {
  const sum = Number(amount) || 0;
  if (total) total.textContent = `Total: ₹${sum.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const statTotal = document.getElementById("statTotalExpense");
  if (statTotal) statTotal.textContent = `₹${sum.toLocaleString("en-IN")}`;
  const statCount = document.getElementById("statExpenseCount");
  if (statCount) statCount.textContent = String(expensePagination?.totalExpenses || 0);
}

function renderExpensePagination() {
  const { currentPage, pageSize, totalExpenses, totalPages } = expensePagination;
  const firstExpense = totalExpenses ? (currentPage - 1) * pageSize + 1 : 0;
  expensePaginationSummary.textContent = totalExpenses
    ? `Showing ${firstExpense}-${Math.min(firstExpense + pageSize - 1, totalExpenses)} of ${totalExpenses} expenses`
    : "Showing 0 expenses";
  expensePageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  const visiblePages = [];
  if (firstPage > 1) visiblePages.push(1, ...(firstPage > 2 ? [null] : []));
  for (let pageNumber = firstPage; pageNumber <= lastPage; pageNumber += 1) visiblePages.push(pageNumber);
  if (lastPage < totalPages) visiblePages.push(...(lastPage < totalPages - 1 ? [null] : []), totalPages);
  expensePageNumbers.innerHTML = visiblePages.map((pageNumber) => pageNumber === null
    ? '<span class="page-ellipsis" aria-hidden="true">...</span>'
    : `<button type="button" data-page="${pageNumber}" aria-label="Page ${pageNumber}"${pageNumber === currentPage ? ' aria-current="page"' : ""}${isLoadingExpenses ? " disabled" : ""}>${pageNumber}</button>`
  ).join("");
  expensePageNavigation.hidden = !expensePaginationReady || totalPages <= 1;
  expensePageSizeSelect.disabled = isLoadingExpenses;
  expensePreviousPage.disabled = isLoadingExpenses || !expensePagination.hasPreviousPage;
  expenseNextPage.disabled = isLoadingExpenses || !expensePagination.hasNextPage;
}

expensePageSizeSelect.value = String(expensePageSize);
expensePageSizeSelect.addEventListener("change", () => {
  const selectedSize = Number(expensePageSizeSelect.value);
  if (isLoadingExpenses || !expensePageSizes.includes(selectedSize)) return;
  expensePageSize = selectedSize;
  localStorage.setItem("expensesPerPage", String(expensePageSize));
  expensePage = 1;
  load(1);
});

expensePreviousPage.addEventListener("click", () => {
  if (!isLoadingExpenses && expensePagination.hasPreviousPage) load(expensePage - 1);
});

expenseNextPage.addEventListener("click", () => {
  if (!isLoadingExpenses && expensePagination.hasNextPage) load(expensePage + 1);
});

expensePageNumbers.addEventListener("click", (event) => {
  const pageButton = event.target.closest("[data-page]");
  const selectedPage = Number(pageButton?.dataset.page);
  if (!isLoadingExpenses && Number.isInteger(selectedPage) && selectedPage >= 1 && selectedPage <= expensePagination.totalPages) {
    load(selectedPage);
  }
});

async function load(page = expensePage) {
  if (!currentUser || !list) return;
  const requestSequence = ++expenseRequestSequence;
  isLoadingExpenses = true;
  expenseListStatus.textContent = "Loading expenses...";
  renderExpensePagination();

  try {
    const data = await request(`/api/expenses?page=${page}&limit=${expensePageSize}`, { headers: authHeaders() });
    if (requestSequence !== expenseRequestSequence) return;
    if (!Array.isArray(data.expenses) || !data.pagination) {
      throw new Error("The expenses response was invalid.");
    }

    const items = data.expenses;
    expensePagination = data.pagination;
    expensePage = expensePagination.currentPage;
    expensePageSize = expensePagination.pageSize;
    expensePageSizeSelect.value = String(expensePageSize);
    expensePaginationReady = true;
    list.innerHTML = "";
    if (items.length === 0) {
      list.innerHTML = '<div class="empty-state">No expenses found.</div>';
    } else {
      items.forEach(x => list.appendChild(renderExpenseItem(x)));
    }
    updateTotalFromList(data.totalAmount);
    expenseListStatus.textContent = "";
  } catch (error) {
    if (requestSequence !== expenseRequestSequence) return;
    expensePaginationReady = false;
    list.innerHTML = '<div class="empty-state">Unable to load expenses. Please try again. <button class="secondary-btn" data-retry-expenses type="button">Retry</button></div>';
    expenseListStatus.textContent = error.message;
  } finally {
    if (requestSequence === expenseRequestSequence) {
      isLoadingExpenses = false;
      renderExpensePagination();
    }
  }
}

list.addEventListener("click", (event) => {
  if (event.target.closest("[data-retry-expenses]")) load();
});

if (authForm) {
  authForm.onsubmit = async e => {
    e.preventDefault();
    const email = authEmail.value.trim().toLowerCase();
    const password = authPassword.value;
    if (!email) {
      authMsg.textContent = "Please enter your email address.";
      authEmail.focus();
      return;
    }
    if (password.length < 6) {
      authMsg.textContent = "Password must be at least 6 characters.";
      authPassword.focus();
      return;
    }
    if (authMode === "register") {
      if (!authName.value.trim()) {
        authMsg.textContent = "Please enter your name.";
        authName.focus();
        return;
      }
      if (!authConfirmPassword.value) {
        authMsg.textContent = "Please confirm your password.";
        authConfirmPassword.focus();
        return;
      }
      if (password !== authConfirmPassword.value) {
        authMsg.textContent = "Passwords do not match.";
        authConfirmPassword.focus();
        return;
      }
    }
    authSubmit.disabled = true;
    if (registerBtn) registerBtn.disabled = true;
    authMsg.textContent = authMode === "register" ? "Creating your account..." : "Logging in...";
    try {
      const path = authMode === "register" ? "/api/auth/signup" : "/api/auth/login";
      const data = await request(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: authMode === "register" ? authName.value.trim() : email.split("@")[0] })
      });

      if (authMode === "register") {
        authForm.reset();
        setAuthMode("login");
        authMsg.textContent = "Account created successfully. Please login.";
        authEmail.focus();
        return;
      }

      setAuth(data);
      authMsg.textContent = "Login successful";
      authForm.reset();
    } catch (error) {
      authMsg.textContent = error.message;
    } finally {
      authSubmit.disabled = false;
      if (registerBtn) registerBtn.disabled = false;
    }
  };
}

if (registerBtn) {
  registerBtn.onclick = () => {
    setAuthMode(authMode === "register" ? "login" : "register");
    if (authMode === "register" && authEmail) authEmail.focus();
  };
}

if (form) {
  form.onsubmit = async e => {
    e.preventDefault();
    const numericAmount = Number(amount.value);
    const textDescription = description.value.trim();
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !textDescription) {
      msg.textContent = "Enter a valid amount and description.";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    msg.textContent = "Adding expense...";

    const body = {
      amount: numericAmount,
      description: textDescription,
      expenseDate: expenseDate?.value || new Date().toISOString().slice(0, 10)
    };
    if (category && category.value) body.category = category.value;

    try {
      // The API response already contains the saved expense, so don't make
      // a second GET request. This makes the UI update immediately after save.
      const x = await request("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body)
      });

      await load(1);
      msg.textContent = x.category ? `Category: ${x.category}` : "Expense added.";
      form.reset();
      if (expenseDate) expenseDate.value = new Date().toISOString().slice(0, 10);
    } catch (error) {
      msg.textContent = error.message;
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  };
}

async function del(id) {
  if (!confirm("Delete this expense?")) return;

  const row = list?.querySelector(`.expense[data-expense-id="${CSS.escape(String(id))}"]`);
  if (row) row.style.opacity = "0.5";

  try {
    await request("/api/expenses/" + encodeURIComponent(id), {
      method: "DELETE",
      headers: authHeaders()
    });
    await load(expensePage);
    if (msg) msg.textContent = "Expense deleted.";
  } catch (error) {
    if (row) row.style.opacity = "1";
    if (msg) msg.textContent = error.message;
  }
}
window.del = del;

if (insightBtn) {
  insightBtn.onclick = async () => {
    insight.innerHTML = '<div class="insight">AI is analyzing...</div>';
    insightBtn.disabled = true;
    try {
      // Never send email as query param — backend uses req.user from JWT
      const x = await request("/api/ai/insight", { headers: authHeaders() });
      insight.innerHTML = `<div class="insight">✨ ${esc(x.insight || x.message || "No insight available.")}</div>
        ${x.tip ? `<div class="insight" style="margin-top:8px;font-size:.9em;">💡 ${esc(x.tip)}</div>` : ""}`;
    } catch (error) {
      insight.innerHTML = `<div class="empty-state">${esc(error.message)}</div>`;
    } finally {
      insightBtn.disabled = false;
    }
  };
}

if (leaderboardRefresh) {
  leaderboardRefresh.addEventListener("click", () => loadLeaderboard());
}

const leaderboardCard = leaderboardRefresh?.closest(".leaderboard-card");
if (leaderboardCard && "IntersectionObserver" in window) {
  const leaderboardObserver = new IntersectionObserver((entries, observer) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadLeaderboard();
      observer.disconnect();
    }
  }, { rootMargin: "160px" });
  leaderboardObserver.observe(leaderboardCard);
}

async function refreshSession() {
  if (!authToken) return;
  try {
    const data = await request("/api/auth/me", { headers: authHeaders() });
    if (data.user) {
      currentUser = data.user;
      localStorage.setItem("loggedInUser", JSON.stringify(currentUser));
      localStorage.setItem("expenseTrackerUser", JSON.stringify(currentUser));
    }
  } catch (error) {
    clearAuth();
  }
}

updatePremiumState();
if (currentUser) {
  refreshSession().finally(() => {
    updatePremiumState();
    load();
  });
}
