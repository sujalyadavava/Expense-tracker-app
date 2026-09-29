/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Wallet,
  Sparkles,
  FileText,
  Crown,
  LogOut,
  PlusCircle,
  Trophy,
  ArrowUpDown,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  DollarSign,
  TrendingUp,
  BarChart3,
  PieChart,
  Download,
  AlertCircle,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  User as UserIcon,
  Tag,
  Clock,
  Layers,
  Sparkle,
  X
} from "lucide-react";

// Types
interface Expense {
  id: string | number;
  amount: number;
  description: string;
  category: string;
  categorySource?: string;
  aiSuggested?: boolean;
  date?: string;
  expenseDate?: string;
  createdAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  isPremium?: boolean;
  ispremiumuser?: boolean;
}

interface LeaderboardUser {
  rank: number;
  id: string;
  name: string;
  email?: string;
  isCurrentUser: boolean;
  totalExpense: number;
  expenseCount: number;
  isPremium: boolean;
}

const CATEGORIES = [
  "Food",
  "Transport",
  "Travel",
  "Shopping",
  "Bills",
  "Entertainment",
  "Health",
  "Education",
  "Salary",
  "Other"
];

const CATEGORY_COLORS: Record<string, string> = {
  Food: "bg-orange-500/15 text-orange-400 border-orange-500/20",
  Transport: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Travel: "bg-cyan-500/15 text-cyan-400 border-cyan-500/20",
  Shopping: "bg-pink-500/15 text-pink-400 border-pink-500/20",
  Bills: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  Entertainment: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  Health: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  Education: "bg-indigo-500/15 text-indigo-400 border-indigo-500/20",
  Salary: "bg-teal-500/15 text-teal-400 border-teal-500/20",
  Other: "bg-slate-500/15 text-slate-400 border-slate-500/20"
};

const CATEGORY_HEX: Record<string, string> = {
  Food: "#f97316",
  Transport: "#3b82f6",
  Travel: "#06b6d4",
  Shopping: "#ec4899",
  Bills: "#f59e0b",
  Entertainment: "#a855f7",
  Health: "#10b981",
  Education: "#6366f1",
  Salary: "#14b8a6",
  Other: "#64748b"
};

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    if (typeof window !== "undefined" && localStorage.getItem("isLoggedOut") === "true") {
      return null;
    }
    try {
      const stored = localStorage.getItem("loggedInUser") || localStorage.getItem("expenseTrackerUser");
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    // Default logged in as realistic user from screenshot
    return {
      id: "usr_sy1908412",
      name: "sy1908412",
      email: "sy1908412@gmail.com",
      isPremium: true,
      ispremiumuser: true
    };
  });

  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem("authToken") || localStorage.getItem("expenseTrackerToken") || "mock_jwt_token_2026";
  });

  // Auth screen state
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authMsg, setAuthMsg] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalExpenseCount, setTotalExpenseCount] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState<boolean>(false);

  // Add Expense form state
  const [amount, setAmount] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [aiSuggestion, setAiSuggestion] = useState<string>("");
  const [isAddingExpense, setIsAddingExpense] = useState<boolean>(false);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState<boolean>(false);
  const [userRank, setUserRank] = useState<number | string>(2);

  // View state: 'dashboard' or 'report'
  const [activeView, setActiveView] = useState<"dashboard" | "report">("dashboard");

  // AI Insight state
  const [showInsightModal, setShowInsightModal] = useState<boolean>(false);
  const [insightText, setInsightText] = useState<string>("");
  const [insightTip, setInsightTip] = useState<string>("");
  const [isLoadingInsight, setIsLoadingInsight] = useState<boolean>(false);

  // Premium modal / confirmation state
  const [showPremiumModal, setShowPremiumModal] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Report filters state
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly" | "custom">("monthly");
  const [reportStartDate, setReportStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [reportEndDate, setReportEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [reportCategory, setReportCategory] = useState<string>("");
  const [reportSearch, setReportSearch] = useState<string>("");

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Initial expenses data seeded for immediate modern SaaS rendering
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

    const initialExpenses: Expense[] = [
      { id: 208, amount: 2000, description: "Lunch at Domino's", category: "Food", categorySource: "user", aiSuggested: false, date: today, expenseDate: today, createdAt: new Date().toISOString() },
      { id: 207, amount: 2800, description: "Groceries & Daily Essentials", category: "Food", categorySource: "ai", aiSuggested: true, date: yesterday, expenseDate: yesterday, createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 206, amount: 4500, description: "Concert tickets for weekend", category: "Entertainment", categorySource: "user", aiSuggested: false, date: twoDaysAgo, expenseDate: twoDaysAgo, createdAt: new Date(Date.now() - 172800000).toISOString() },
      { id: 205, amount: 6200, description: "Fine Dining Dinner with Family", category: "Food", categorySource: "ai", aiSuggested: true, date: "2026-09-27", expenseDate: "2026-09-27", createdAt: "2026-09-27T20:30:00Z" },
      { id: 204, amount: 9500, description: "Electricity & High-speed Fiber Bill", category: "Bills", categorySource: "user", aiSuggested: false, date: "2026-09-25", expenseDate: "2026-09-25", createdAt: "2026-09-25T15:00:00Z" },
      { id: 203, amount: 14000, description: "Weekend Resort Stay in Goa", category: "Travel", categorySource: "user", aiSuggested: false, date: "2026-09-23", expenseDate: "2026-09-23", createdAt: "2026-09-23T11:00:00Z" },
      { id: 202, amount: 16000, description: "Health Insurance Annual Premium", category: "Health", categorySource: "ai", aiSuggested: true, date: "2026-09-21", expenseDate: "2026-09-21", createdAt: "2026-09-21T10:00:00Z" },
      { id: 201, amount: 20000, description: "Apple Watch Series 10", category: "Shopping", categorySource: "user", aiSuggested: false, date: "2026-09-18", expenseDate: "2026-09-18", createdAt: "2026-09-18T10:00:00Z" }
    ];

    setExpenses(initialExpenses);
    const sum = initialExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    setTotalAmount(sum);
    setTotalExpenseCount(initialExpenses.length);
    setTotalPages(Math.ceil(initialExpenses.length / pageSize));

    // Seed leaderboard matching screenshot
    setLeaderboard([
      { rank: 1, id: "1", name: "sujal98357", totalExpense: 88000, expenseCount: 7, isPremium: true, isCurrentUser: false },
      { rank: 2, id: "2", name: "sy1908412", totalExpense: 75000, expenseCount: 8, isPremium: true, isCurrentUser: true },
      { rank: 3, id: "3", name: "User_Community", totalExpense: 2000, expenseCount: 1, isPremium: false, isCurrentUser: false }
    ]);
  }, [pageSize]);

  // AI Category Suggestion (debounced)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDescription(val);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (!val.trim()) {
      setAiSuggestion("");
      return;
    }

    debounceTimer.current = setTimeout(() => {
      const lower = val.toLowerCase();
      let suggested = "Other";
      if (/lunch|dinner|breakfast|food|pizza|burger|domino|restaurant|cafe|snack|zomato|swiggy/.test(lower)) {
        suggested = "Food";
      } else if (/uber|ola|cab|taxi|metro|bus|train|auto|fuel|petrol|diesel/.test(lower)) {
        suggested = "Transport";
      } else if (/flight|hotel|trip|resort|vacation|tour|travel/.test(lower)) {
        suggested = "Travel";
      } else if (/amazon|flipkart|shop|shirt|shoes|watch|buy|purchase|store|dress/.test(lower)) {
        suggested = "Shopping";
      } else if (/bill|electricity|water|wifi|internet|recharge|rent|insurance/.test(lower)) {
        suggested = "Bills";
      } else if (/movie|cinema|netflix|spotify|game|concert|entertainment/.test(lower)) {
        suggested = "Entertainment";
      } else if (/doctor|medicine|health|clinic|pharmacy|hospital|gym/.test(lower)) {
        suggested = "Health";
      } else if (/course|school|college|exam|book|education|study/.test(lower)) {
        suggested = "Education";
      }
      setAiSuggestion(suggested);
    }, 300);
  };

  // Add Expense submission handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    const cleanDesc = description.trim();

    if (!numAmount || numAmount <= 0 || !cleanDesc) {
      showToast("Please enter a valid amount and description.", "error");
      return;
    }

    setIsAddingExpense(true);

    const finalCategory = category && category !== "" ? category : (aiSuggestion || "Other");
    const isAi = !category || category === "";

    // Simulated short network delay for smooth modern feedback
    await new Promise((resolve) => setTimeout(resolve, 400));

    const newExp: Expense = {
      id: Date.now(),
      amount: numAmount,
      description: cleanDesc,
      category: finalCategory,
      categorySource: isAi ? "ai" : "user",
      aiSuggested: isAi,
      date: selectedDate,
      expenseDate: selectedDate,
      createdAt: new Date().toISOString()
    };

    setExpenses((prev) => [newExp, ...prev]);
    setTotalAmount((prev) => prev + numAmount);
    setTotalExpenseCount((prev) => prev + 1);

    // Update leaderboard current user
    setLeaderboard((prev) =>
      prev.map((item) =>
        item.isCurrentUser
          ? { ...item, totalExpense: item.totalExpense + numAmount, expenseCount: item.expenseCount + 1 }
          : item
      )
    );

    // Reset form
    setAmount("");
    setDescription("");
    setCategory("");
    setAiSuggestion("");
    setIsAddingExpense(false);

    showToast(`Added ₹${numAmount.toLocaleString("en-IN")} in ${finalCategory}!`, "success");
  };

  // Delete expense handler
  const handleDeleteExpense = (id: string | number) => {
    const item = expenses.find((e) => e.id === id);
    if (!item) return;

    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setTotalAmount((prev) => Math.max(0, prev - item.amount));
    setTotalExpenseCount((prev) => Math.max(0, prev - 1));

    // Update leaderboard
    setLeaderboard((prev) =>
      prev.map((u) =>
        u.isCurrentUser
          ? { ...u, totalExpense: Math.max(0, u.totalExpense - item.amount), expenseCount: Math.max(0, u.expenseCount - 1) }
          : u
      )
    );

    showToast("Expense removed successfully.", "info");
  };

  // AI Insight handler
  const handleGetInsight = async () => {
    setIsLoadingInsight(true);
    setShowInsightModal(true);

    await new Promise((resolve) => setTimeout(resolve, 600));

    // Calculate insight dynamically based on expenses
    const categoryTotals: Record<string, number> = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });

    const sortedCats = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
    if (sortedCats.length > 0) {
      const [topCat, topVal] = sortedCats[0];
      const pct = totalAmount > 0 ? Math.round((topVal / totalAmount) * 100) : 0;
      setInsightText(`Your top expenditure category is ${topCat}, accounting for ₹${topVal.toLocaleString("en-IN")} (${pct}% of total spending).`);
      setInsightTip(`Consider setting a monthly cap of ₹${Math.round(topVal * 0.85).toLocaleString("en-IN")} on ${topCat} to save up to 15% next month.`);
    } else {
      setInsightText("No spending data recorded yet. Log your daily transactions to unlock personalised AI financial insights.");
      setInsightTip("Track at least 5 expenses across multiple categories to receive actionable budgeting recommendations.");
    }
    setIsLoadingInsight(false);
  };

  // Refresh leaderboard
  const handleRefreshLeaderboard = async () => {
    setIsLoadingLeaderboard(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsLoadingLeaderboard(false);
    showToast("Leaderboard updated with latest community rankings.", "success");
  };

  // Buy Premium handler
  const handleActivatePremium = () => {
    if (currentUser) {
      const updated = { ...currentUser, isPremium: true, ispremiumuser: true };
      setCurrentUser(updated);
      localStorage.setItem("loggedInUser", JSON.stringify(updated));
      localStorage.setItem("expenseTrackerUser", JSON.stringify(updated));

      // Update in leaderboard
      setLeaderboard((prev) =>
        prev.map((u) => (u.isCurrentUser ? { ...u, isPremium: true } : u))
      );
    }
    setShowPremiumModal(false);
    showToast("🎉 Transaction Successful! You are now a Premium Member!", "success");
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("expenseTrackerToken");
    localStorage.removeItem("loggedInUser");
    localStorage.removeItem("expenseTrackerUser");
    localStorage.setItem("isLoggedOut", "true");
    setCurrentUser(null);
    setAuthToken("");
    setAuthMsg("");
    showToast("You have been securely logged out.", "info");
  };

  // Auth Submit handler (Login or Register)
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAuth(true);
    setAuthMsg("");

    try {
      const endpoint = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
      const payload = authMode === "login" 
        ? { email: authEmail, password: authPassword }
        : { name: authName || "User", email: authEmail, password: authPassword };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Authentication failed. Please check your credentials.");
      }

      localStorage.removeItem("isLoggedOut");
      if (data.token) {
        localStorage.setItem("authToken", data.token);
        localStorage.setItem("expenseTrackerToken", data.token);
        setAuthToken(data.token);
      }
      if (data.user) {
        localStorage.setItem("loggedInUser", JSON.stringify(data.user));
        localStorage.setItem("expenseTrackerUser", JSON.stringify(data.user));
        setCurrentUser(data.user);
      }

      showToast(authMode === "login" ? `Welcome back, ${data.user?.name || "User"}!` : "Account created successfully!", "success");
    } catch (err: any) {
      setAuthMsg(err.message || "Failed to authenticate.");
      showToast(err.message || "Failed to authenticate.", "error");
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Quick Demo Login helper
  const handleQuickDemoLogin = (email = "sy1908412@gmail.com", name = "sy1908412") => {
    const demoUser: User = {
      id: "usr_sy1908412",
      name: name,
      email: email,
      isPremium: true,
      ispremiumuser: true
    };
    localStorage.removeItem("isLoggedOut");
    localStorage.setItem("loggedInUser", JSON.stringify(demoUser));
    localStorage.setItem("expenseTrackerUser", JSON.stringify(demoUser));
    localStorage.setItem("authToken", "mock_jwt_token_2026");
    localStorage.setItem("expenseTrackerToken", "mock_jwt_token_2026");
    setCurrentUser(demoUser);
    setAuthToken("mock_jwt_token_2026");
    showToast(`Logged in as ${demoUser.name}`, "success");
  };

  // Format currency helper
  const fmtCurrency = (val: number) => {
    return `₹${Number(val || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  };

  // Format date helper (e.g. 30 Sep 2026)
  const fmtDate = (dString?: string) => {
    if (!dString) return "—";
    const dt = new Date(dString.length === 10 ? dString + "T12:00:00" : dString);
    if (isNaN(dt.getTime())) return dString;
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  // Report calculations & filtered expenses
  const filteredReportExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const expDate = e.date || e.expenseDate || (e.createdAt ? e.createdAt.slice(0, 10) : "");

      // Date range filter
      if (reportStartDate && expDate && expDate < reportStartDate) return false;
      if (reportEndDate && expDate && expDate > reportEndDate) return false;

      // Category filter
      if (reportCategory && e.category !== reportCategory) return false;

      // Search filter
      if (reportSearch.trim()) {
        const query = reportSearch.toLowerCase();
        const matchesDesc = e.description.toLowerCase().includes(query);
        const matchesCat = e.category.toLowerCase().includes(query);
        if (!matchesDesc && !matchesCat) return false;
      }

      return true;
    });
  }, [expenses, reportStartDate, reportEndDate, reportCategory, reportSearch]);

  const reportTotalAmount = useMemo(() => {
    return filteredReportExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [filteredReportExpenses]);

  const reportAverageExpense = useMemo(() => {
    if (!filteredReportExpenses.length) return 0;
    return Math.round(reportTotalAmount / filteredReportExpenses.length);
  }, [filteredReportExpenses, reportTotalAmount]);

  const reportHighestExpense = useMemo(() => {
    if (!filteredReportExpenses.length) return 0;
    return Math.max(...filteredReportExpenses.map((e) => e.amount));
  }, [filteredReportExpenses]);

  // Category breakdown for charts
  const categoryChartData = useMemo(() => {
    const mapping: Record<string, number> = {};
    filteredReportExpenses.forEach((e) => {
      mapping[e.category] = (mapping[e.category] || 0) + e.amount;
    });
    const total = Object.values(mapping).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(mapping)
      .map(([cat, val]) => ({
        category: cat,
        amount: val,
        percentage: Math.round((val / total) * 100)
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredReportExpenses]);

  // Time distribution for charts
  const timelineChartData = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    filteredReportExpenses.forEach((e) => {
      const key = e.date || e.expenseDate || "Recent";
      dailyMap[key] = (dailyMap[key] || 0) + e.amount;
    });
    return Object.entries(dailyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7);
  }, [filteredReportExpenses]);

  // CSV Download simulation
  const handleDownloadCsv = () => {
    if (!currentUser?.isPremium && !currentUser?.ispremiumuser) {
      setShowPremiumModal(true);
      return;
    }
    const headers = "Date,Description,Category,Amount (INR)\n";
    const rows = filteredReportExpenses
      .map((e) => `"${fmtDate(e.date)}","${e.description.replace(/"/g, '""')}","${e.category}",${e.amount}`)
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Expense_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV Report downloaded successfully.", "success");
  };

  const handleDownloadPdf = () => {
    if (!currentUser?.isPremium && !currentUser?.ispremiumuser) {
      setShowPremiumModal(true);
      return;
    }
    showToast("PDF Report compiled and ready for download.", "success");
    window.print();
  };

  const isUserPremium = Boolean(currentUser?.isPremium || currentUser?.ispremiumuser);

  // Quick Period Selector
  const handleSetQuickPeriod = (p: "daily" | "weekly" | "monthly" | "yearly" | "custom") => {
    setReportPeriod(p);
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    setReportEndDate(todayStr);

    if (p === "daily") {
      setReportStartDate(todayStr);
    } else if (p === "weekly") {
      const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      setReportStartDate(lastWeek);
    } else if (p === "monthly") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      setReportStartDate(startOfMonth);
    } else if (p === "yearly") {
      const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
      setReportStartDate(startOfYear);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b13] text-slate-100 font-sans antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border backdrop-blur-md bg-slate-900/95 transition-all transform animate-in fade-in slide-in-from-top-4 border-slate-700/80">
          {toastMessage.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
          {toastMessage.type === "error" && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
          {toastMessage.type === "info" && <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />}
          <p className="text-sm font-medium text-slate-100">{toastMessage.text}</p>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-200 ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {!currentUser ? (
        <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 py-8">
          <div className="w-full max-w-md space-y-6">
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black mb-1">
                <Wallet className="w-7 h-7 text-slate-950" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  Smart Expense Tracker
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <Sparkle className="w-3 h-3 fill-emerald-400" />
                  AI Powered
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400">
                Track spending, manage budgets, and let AI optimize your finances.
              </p>
            </div>

            {/* Auth Card */}
            <div className="p-6 sm:p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-md space-y-5">
              {/* Tab Switcher */}
              <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setAuthMode("login"); setAuthMsg(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === "login"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode("register"); setAuthMsg(""); }}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    authMode === "register"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Create Account
                </button>
              </div>

              {authMsg && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authMsg}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleAuthSubmit} className="space-y-4">
                {authMode === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Your Name"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-emerald-500 focus:outline-none text-sm text-slate-100 placeholder:text-slate-500 transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingAuth}
                  className="w-full py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 transition-all cursor-pointer shadow-lg shadow-emerald-500/15 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmittingAuth ? (
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : authMode === "login" ? (
                    "Sign In"
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              {/* Quick Demo Access Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-800 w-full" />
                <span className="bg-slate-900 px-3 text-[11px] uppercase tracking-wider text-slate-500 shrink-0 font-medium">
                  Instant Demo Access
                </span>
              </div>

              {/* 1-Click Demo Login */}
              <button
                type="button"
                onClick={() => handleQuickDemoLogin()}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Quick Demo Login (sy1908412)</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Container */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* ========================================================
            TOP HEADER (Modern SaaS 3-Zone Contract)
        ======================================================== */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 shadow-xl backdrop-blur-md">
          {/* Logo & Branding */}
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-black">
              <Wallet className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-['Plus_Jakarta_Sans']">
                  Smart Expense Tracker
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/25">
                  <Sparkle className="w-3 h-3 fill-emerald-400" />
                  AI Powered
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Intelligent financial tracking &amp; automated category insights
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center flex-wrap gap-2.5">
            {/* AI Spending Insight Button */}
            <button
              onClick={handleGetInsight}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>AI Spending Insight</span>
            </button>

            {/* Expense Report View Toggle Button */}
            <button
              onClick={() => setActiveView(activeView === "dashboard" ? "report" : "dashboard")}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium border transition-all cursor-pointer ${
                activeView === "report"
                  ? "bg-slate-800 text-emerald-400 border-emerald-500/40 shadow-sm"
                  : "bg-slate-900/90 text-slate-300 border-slate-700/80 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{activeView === "report" ? "← Back to Dashboard" : "Expense Report"}</span>
            </button>

            {/* Premium Button / Status */}
            {isUserPremium ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 shadow-sm shadow-amber-500/5">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Premium User</span>
              </div>
            ) : (
              <button
                onClick={() => setShowPremiumModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] shadow-md shadow-amber-400/20 transition-all cursor-pointer"
              >
                <Crown className="w-4 h-4 text-slate-950" />
                <span>Buy Premium</span>
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              title="Logout"
              className="inline-flex items-center justify-center p-2 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-medium text-rose-300 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 hover:text-rose-200 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline ml-1.5">Logout</span>
            </button>
          </div>
        </header>

        {/* ========================================================
            COMPACT STATISTICS SECTION (4 Cards, Responsive Grid)
        ======================================================== */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Expense */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm flex flex-col justify-between h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Total Expense
              </span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                {fmtCurrency(totalAmount)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">All-time tracked expenditure</p>
            </div>
          </div>

          {/* Card 2: Number of Expenses */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm flex flex-col justify-between h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Number of Expenses
              </span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                {totalExpenseCount}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Total transactions logged</p>
            </div>
          </div>

          {/* Card 3: Current Rank */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm flex flex-col justify-between h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current Rank
              </span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Trophy className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 tracking-tight font-mono tabular-nums">
                #{userRank}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">On community leaderboard</p>
            </div>
          </div>

          {/* Card 4: Membership Status */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition-all shadow-sm flex flex-col justify-between h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Membership Status
              </span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-1.5">
                {isUserPremium ? (
                  <span className="text-amber-300 flex items-center gap-1">
                    <Crown className="w-5 h-5 fill-amber-300" />
                    Premium Plan
                  </span>
                ) : (
                  <span className="text-slate-300">Free Tier</span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isUserPremium ? "Full access & report downloads" : "Standard spending analytics"}
              </p>
            </div>
          </div>
        </section>

        {/* ========================================================
            VIEW 1: MAIN DASHBOARD (Add Expense + Recent List + Leaderboard)
        ======================================================== */}
        {activeView === "dashboard" ? (
          <div className="space-y-6">
            {/* ADD EXPENSE SECTION */}
            <section className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/60 border border-slate-800/90 shadow-xl relative overflow-hidden">
              {/* Subtle accent glow top border */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/40 via-teal-400/60 to-emerald-500/20" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-emerald-400" />
                    Add Expense
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Enter transaction details. AI will auto-categorize if left blank.
                  </p>
                </div>
                {aiSuggestion && (
                  <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>AI Suggests: <strong>{aiSuggestion}</strong></span>
                  </div>
                )}
              </div>

              {/* Form Grid */}
              <form onSubmit={handleAddExpense} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
                {/* 1. Amount */}
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Amount (₹) <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g. 450"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all font-mono tabular-nums"
                    />
                  </div>
                </div>

                {/* 2. Expense Description */}
                <div className="lg:col-span-4">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Expense Description <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lunch at Domino's"
                    value={description}
                    onChange={handleDescriptionChange}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all"
                  />
                </div>

                {/* 3. Category */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all cursor-pointer"
                  >
                    <option value="">🤖 Let AI choose {aiSuggestion ? `(${aiSuggestion})` : ""}</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 4. Date Picker (HTML date picker) */}
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Date <span className="text-emerald-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-all scheme-dark cursor-pointer font-mono"
                    />
                  </div>
                </div>

                {/* 5. Add Expense Button */}
                <div className="lg:col-span-12 flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isAddingExpense}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {isAddingExpense ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Adding…</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4 text-slate-950" />
                        <span>Add Expense</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* RECENT EXPENSES TABLE CARD */}
            <section className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-emerald-400" />
                    Recent Expenses
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Your real-time transaction ledger with readable dates and AI source tracking
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={40}>40</option>
                  </select>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4 text-right">Amount</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-normal">
                    {expenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400">
                          <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2 opacity-60" />
                          <p className="text-sm">No expenses recorded yet.</p>
                          <p className="text-xs text-slate-500 mt-1">Add your first expense above to start tracking.</p>
                        </td>
                      </tr>
                    ) : (
                      expenses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((exp) => (
                        <tr
                          key={exp.id}
                          className="hover:bg-slate-800/30 transition-colors group"
                        >
                          {/* Date formatted as DD MMM YYYY */}
                          <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap font-mono text-xs">
                            {fmtDate(exp.date || exp.expenseDate || exp.createdAt)}
                          </td>

                          {/* Description */}
                          <td className="py-3.5 px-4 text-white font-medium">
                            <div className="flex items-center gap-2">
                              <span>{exp.description}</span>
                              {exp.aiSuggested && (
                                <span className="inline-flex items-center text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                  AI
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Category Badge */}
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other
                              }`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: CATEGORY_HEX[exp.category] || "#64748b" }}
                              />
                              {exp.category}
                            </span>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4 text-right text-emerald-300 font-mono font-bold whitespace-nowrap tabular-nums">
                            {fmtCurrency(exp.amount)}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              title="Delete Expense"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination bar */}
              {expenses.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 text-xs text-slate-400">
                  <p>
                    Showing {(currentPage - 1) * pageSize + 1}–
                    {Math.min(currentPage * pageSize, expenses.length)} of {expenses.length} expenses
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage <= 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      Previous
                    </button>
                    <span className="font-mono px-2">
                      Page {currentPage} of {Math.max(1, Math.ceil(expenses.length / pageSize))}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(Math.ceil(expenses.length / pageSize), p + 1))}
                      disabled={currentPage >= Math.ceil(expenses.length / pageSize)}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors flex items-center gap-1"
                    >
                      Next
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* LEADERBOARD CARD */}
            <section className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-amber-400 uppercase tracking-widest">
                      COMMUNITY
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                    <Trophy className="w-5 h-5 text-amber-400" />
                    Spending Leaderboard
                  </h2>
                </div>

                <button
                  onClick={handleRefreshLeaderboard}
                  disabled={isLoadingLeaderboard}
                  className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800/80 border border-slate-700/80 hover:bg-slate-800 hover:text-white transition-all cursor-pointer"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isLoadingLeaderboard ? "animate-spin text-emerald-400" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {/* My Stats Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">My Rank:</span>
                  <span className="font-bold text-amber-300 font-mono text-sm">#{userRank}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">My Total Expense:</span>
                  <span className="font-bold text-emerald-300 font-mono text-sm">{fmtCurrency(totalAmount)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">My Expense Count:</span>
                  <span className="font-bold text-white font-mono text-sm">{totalExpenseCount}</span>
                </div>
              </div>

              {/* Leaderboard Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3.5 px-4 w-16">Rank</th>
                      <th className="py-3.5 px-4">User</th>
                      <th className="py-3.5 px-4">Membership</th>
                      <th className="py-3.5 px-4 text-right">Total Expense</th>
                      <th className="py-3.5 px-4 text-right">Expenses</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {leaderboard.map((item) => (
                      <tr
                        key={item.id}
                        className={`transition-colors ${
                          item.isCurrentUser
                            ? "bg-amber-500/5 hover:bg-amber-500/10 font-medium"
                            : "hover:bg-slate-800/20"
                        }`}
                      >
                        {/* Rank */}
                        <td className="py-3.5 px-4 font-mono font-bold">
                          {item.rank === 1 && <span className="text-amber-400">🥇 #1</span>}
                          {item.rank === 2 && <span className="text-slate-300">🥈 #2</span>}
                          {item.rank === 3 && <span className="text-amber-600">🥉 #3</span>}
                          {item.rank > 3 && <span className="text-slate-400">#{item.rank}</span>}
                        </td>

                        {/* User */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">{item.name}</span>
                            {item.isCurrentUser && (
                              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                                You
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Membership Badge */}
                        <td className="py-3.5 px-4">
                          {item.isPremium ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
                              <Crown className="w-3 h-3 fill-amber-300 text-amber-300" />
                              Premium
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                              Free
                            </span>
                          )}
                        </td>

                        {/* Total Expense */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-100 tabular-nums">
                          {fmtCurrency(item.totalExpense)}
                        </td>

                        {/* Expense Count */}
                        <td className="py-3.5 px-4 text-right font-mono text-slate-400 tabular-nums">
                          {item.expenseCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : (
          /* ========================================================
              VIEW 2: EXPENSE REPORT FRONTEND DASHBOARD
          ======================================================== */
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                  SPENDING OVERVIEW
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                  Expense Report &amp; Analytics
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  Filter, aggregate, and visualize your spending habits over time
                </p>
              </div>

              {/* Download Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-emerald-400 hover:bg-emerald-300 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* SUMMARY CARDS (Total Expenses, Total Amount, Average Expense, Highest Expense) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Total Expenses */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Expenses
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-white font-mono mt-1 tabular-nums">
                  {filteredReportExpenses.length}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Transactions in range</p>
              </div>

              {/* 2. Total Amount */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Total Amount
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono mt-1 tabular-nums">
                  {fmtCurrency(reportTotalAmount)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Sum of filtered spending</p>
              </div>

              {/* 3. Average Expense */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Average Expense
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-blue-400 font-mono mt-1 tabular-nums">
                  {fmtCurrency(reportAverageExpense)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Per-transaction average</p>
              </div>

              {/* 4. Highest Expense */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Highest Expense
                </p>
                <p className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono mt-1 tabular-nums">
                  {fmtCurrency(reportHighestExpense)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Single largest purchase</p>
              </div>
            </div>

            {/* FILTER SECTION */}
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="w-4 h-4 text-emerald-400" />
                  Filter Options
                </h3>

                {/* Quick Period Buttons */}
                <div className="inline-flex rounded-xl p-1 bg-slate-950 border border-slate-800 text-xs">
                  {(["daily", "weekly", "monthly", "yearly"] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => handleSetQuickPeriod(period)}
                      className={`px-3 py-1 rounded-lg font-medium capitalize transition-all cursor-pointer ${
                        reportPeriod === period
                          ? "bg-emerald-500/20 text-emerald-300 font-semibold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
                {/* Start Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(e) => {
                      setReportStartDate(e.target.value);
                      setReportPeriod("custom");
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs font-mono scheme-dark"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">End Date</label>
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(e) => {
                      setReportEndDate(e.target.value);
                      setReportPeriod("custom");
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs font-mono scheme-dark"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                  <select
                    value={reportCategory}
                    onChange={(e) => setReportCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs"
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search */}
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Search Description</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="e.g. Domino's, Rent"
                      value={reportSearch}
                      onChange={(e) => setReportSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700/80 text-white text-xs placeholder-slate-500"
                    />
                  </div>
                </div>

                {/* Clear Filters Button */}
                <div>
                  <button
                    onClick={() => {
                      setReportCategory("");
                      setReportSearch("");
                      handleSetQuickPeriod("monthly");
                    }}
                    className="w-full py-2 px-3 rounded-xl border border-slate-700/80 bg-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Clear Filters</span>
                  </button>
                </div>
              </div>
            </div>

            {/* EXPENSE REPORT VISUALIZATION (Charts) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Spending by Category */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-emerald-400" />
                    Spending by Category
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">
                    {categoryChartData.length} active
                  </span>
                </div>

                {categoryChartData.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No category data for current filter.</p>
                ) : (
                  <div className="space-y-2.5">
                    {categoryChartData.map((item) => (
                      <div key={item.category} className="space-y-1">
                        <div className="flex justify-between text-xs font-medium">
                          <span className="text-slate-300 flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: CATEGORY_HEX[item.category] || "#64748b" }}
                            />
                            {item.category}
                          </span>
                          <span className="font-mono text-slate-200">
                            {fmtCurrency(item.amount)} ({item.percentage}%)
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${item.percentage}%`,
                              backgroundColor: CATEGORY_HEX[item.category] || "#10b981"
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Spending over Time */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    Spending Timeline
                  </h3>
                  <span className="text-xs text-slate-400 font-mono">Recent Days</span>
                </div>

                {timelineChartData.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">No timeline data available.</p>
                ) : (
                  <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2">
                    {(() => {
                      const maxVal = Math.max(...timelineChartData.map((d) => d[1]), 1);
                      return timelineChartData.map(([dStr, val]) => {
                        const heightPct = Math.max(12, Math.round((val / maxVal) * 100));
                        return (
                          <div key={dStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                            <span className="text-[10px] font-mono text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              ₹{val}
                            </span>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full rounded-t-lg bg-gradient-to-t from-blue-600/40 to-blue-400 hover:to-emerald-400 transition-all cursor-pointer"
                            />
                            <span className="text-[10px] text-slate-400 font-mono truncate w-full text-center">
                              {dStr.slice(5)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* REPORT TABLE */}
            <div className="p-5 sm:p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <h3 className="text-sm font-bold text-white">Filtered Transactions ({filteredReportExpenses.length})</h3>

              <div className="overflow-x-auto rounded-xl border border-slate-800/70">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-950/60 text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredReportExpenses.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-slate-400 text-sm">
                          No expenses found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredReportExpenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 text-slate-300 font-mono text-xs whitespace-nowrap">
                            {fmtDate(exp.date || exp.expenseDate || exp.createdAt)}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">{exp.description}</td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other
                              }`}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: CATEGORY_HEX[exp.category] || "#64748b" }}
                              />
                              {exp.category}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-emerald-300 font-mono font-bold whitespace-nowrap tabular-nums">
                            {fmtCurrency(exp.amount)}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================
          MODAL: AI SPENDING INSIGHT
      ======================================================== */}
      {showInsightModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">AI Spending Insight</h3>
              </div>
              <button
                onClick={() => setShowInsightModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingInsight ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-400">AI is evaluating your expenditure patterns…</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">
                    ✨ {insightText}
                  </p>
                </div>
                {insightTip && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2.5">
                    <span className="text-base">💡</span>
                    <p className="text-xs text-emerald-300 leading-relaxed italic">{insightTip}</p>
                  </div>
                )}
                <p className="text-[11px] text-slate-500 text-right">Source: AI Spending Intelligence Engine</p>
              </div>
            )}

            <button
              onClick={() => setShowInsightModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL: BUY PREMIUM MEMBERSHIP
      ======================================================== */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-amber-500/30 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Crown className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Upgrade to Premium</h3>
                  <p className="text-xs text-amber-400 font-medium">Unlock pro analytics &amp; reports</p>
                </div>
              </div>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited CSV &amp; PDF Report Downloads</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Advanced Category Breakdown &amp; Spending Trend Visualizations</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Unlimited AI Spending Insights &amp; Budget Optimization Tips</span>
                </div>
                <div className="flex items-center gap-2 text-slate-200">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Permanent Gold 👑 Crown Badge on the Community Leaderboard</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-300 font-medium">One-time Lifetime Access</span>
                  <div className="text-2xl font-black text-white font-mono">₹199</div>
                </div>
                <span className="px-2.5 py-1 rounded-lg text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30">
                  Save 80%
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowPremiumModal(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivatePremium}
                className="flex-2 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Crown className="w-4 h-4 fill-slate-950" />
                <span>Confirm Payment (₹199)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )}
</div>
  );
}
