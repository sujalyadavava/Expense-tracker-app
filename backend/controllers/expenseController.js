const db = require("../utils/db");
const { categorizeExpense } = require("../services/aiService");
const { buildReport } = require("../services/reportService");
const { createCsvReport } = require("../services/csvReportService");
const { createPdfReport } = require("../services/pdfReportService");

const CATEGORIES = new Set([
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
]);

exports.getExpenses = async (req, res) => {
  try {
    const email = req.user.email;
    if (!email) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const rawPage = req.query.page ?? "1";
    const rawLimit = req.query.limit ?? "10";
    const page = Number(rawPage);
    const limit = Number(rawLimit);
    const allowedPageSizes = new Set([5, 10, 20, 30, 40]);
    if (!/^\d+$/.test(String(rawPage)) || !Number.isSafeInteger(page) || page < 1) {
      return res.status(400).json({ success: false, message: "Page must be a positive integer." });
    }
    if (!/^\d+$/.test(String(rawLimit)) || !allowedPageSizes.has(limit)) {
      return res.status(400).json({ success: false, message: "Limit must be one of 5, 10, 20, 30, or 40." });
    }

    const result = await db.getExpensesPage(email, { page, limit });
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("getExpenses error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Could not load expenses." });
  }
};
exports.createExpense = async (req, res) => {
  try {
    const { amount, description, category, categorySource, expenseDate, date } = req.body;
    const email = req.user.email;
    const numericAmount = Number(amount);

    const trimmedDescription = String(description || "").trim();
    const requestedCategory = category ? String(category).trim() : "Other";
    const rawDate = date || expenseDate;
    const parsedExpenseDate = rawDate ? new Date(String(rawDate).length === 10 ? String(rawDate) + "T12:00:00" : String(rawDate)) : new Date();
    if (Number.isNaN(parsedExpenseDate.getTime())) {
      return res.status(400).json({ success: false, message: "Please select a valid expense date." });
    }

    if (
      !email ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      numericAmount > 1000000000 ||
      !trimmedDescription ||
      trimmedDescription.length > 500 ||
      !CATEGORIES.has(requestedCategory)
    ) {
      return res.status(400).json({ success: false, message: "Valid amount and description are required." });
    }

    let finalCategory = requestedCategory;
    let finalSource = categorySource || (category ? "user" : "fallback");
    let aiSuggested = false;

    if (!category) {
      const suggestion = await categorizeExpense(trimmedDescription);
      finalCategory = suggestion.category;
      finalSource = suggestion.source;
      aiSuggested = suggestion.source === "ai";
    }

    const created = await db.addExpense({
      email,
      amount: numericAmount,
      description: trimmedDescription,
      category: String(finalCategory),
      categorySource: finalSource,
      aiSuggested,
      userId: req.user?.id || null,
      expenseDate: parsedExpenseDate
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error("createExpense error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: "Invalid expense data." });
    }
    return res.status(500).json({ success: false, message: error.message || "Could not add expense." });
  }
};
exports.deleteExpense = async (req, res) => {
  try {
    const email = req.user.email;
    const rawId = String(req.params.id || "").trim();

    if (!email || !rawId) {
      return res.status(400).json({ success: false, message: "Email and expense ID are required." });
    }

    await db.deleteExpense(email, rawId);
    return res.json({ success: true, message: "Expense deleted successfully." });
  } catch (error) {
    console.error("deleteExpense error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Expense not found." });
  }
};

exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard(req.user.email);
    return res.json({ success: true, leaderboard });
  } catch (error) {
    console.error("getLeaderboard error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Unable to load leaderboard." });
  }
};

exports.downloadReport = async (req, res) => {
  try {
    // Premium gate — checked against DB-backed user (req.user is re-fetched by auth middleware).
    if (!req.user.isPremium && !req.user.ispremiumuser) {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Only users with premium membership can download reports."
      });
    }

    const format = String(req.query.format || req.query.type || "").toLowerCase();
    const report = await buildReport(
      req.user.email,   // always use server-side identity — never trust frontend userId
      req.user.name,
      req.query.period,
      req.query.date,
      req.user.email    // pass email so PDF can display it
    );

    // Return a clean 200 message instead of an empty/broken file when there
    // are no transactions in the selected period.
    if (!report.transactions.length) {
      if (format === "csv" || format === "pdf") {
        return res.status(200).json({
          success: false,
          message: `No expenses found for the selected ${report.period || "period"}. Nothing to download.`
        });
      }
      return res.json({
        success: true,
        fileName: report.fileName,
        period: report.period,
        dateRange: report.dateRange,
        totalExpense: report.totalExpense,
        transactions: [],
        message: "No expenses found for the selected period."
      });
    }

    if (format === "csv" || String(req.headers.accept || "").includes("text/csv")) {
      const csv = createCsvReport(report);
      res.set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${report.fileName}.csv"`
      });
      return res.send(csv);
    }

    if (format === "pdf") {
      const pdf = await createPdfReport(report);
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${report.fileName}.pdf"`
      });
      return res.send(pdf);
    }

    return res.json({
      success: true,
      fileName: report.fileName,
      period: report.period,
      dateRange: report.dateRange,
      totalExpense: report.totalExpense,
      transactions: report.transactions
    });
  } catch (error) {
    console.error("downloadReport error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Could not generate report." });
  }
};

