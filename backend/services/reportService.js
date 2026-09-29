const db = require("../utils/db");

const PERIODS = new Set(["daily", "weekly", "monthly", "yearly"]);

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function parseAnchorDate(value) {
  if (!value) return startOfDay(new Date());
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return startOfDay(new Date());
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// Format a Date as DD/MM/YYYY (locale-independent)
function formatDMY(date) {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getPeriodRange(period, dateValue) {
  const selectedPeriod = PERIODS.has(period) ? period : "daily";
  const anchor = parseAnchorDate(dateValue);

  let start, end;

  if (selectedPeriod === "daily") {
    // 00:00:00 to 23:59:59 of the selected date
    start = startOfDay(anchor);
    end   = new Date(start);
    end.setDate(end.getDate() + 1); // exclusive upper bound for $lt
  } else if (selectedPeriod === "weekly") {
    // Sunday 00:00:00 through Saturday 23:59:59
    start = startOfDay(anchor);
    start.setDate(start.getDate() - start.getDay()); // rewind to Sunday
    end   = new Date(start);
    end.setDate(end.getDate() + 7); // exclusive: next Sunday 00:00:00
  } else if (selectedPeriod === "monthly") {
    // First day 00:00:00 through last day 23:59:59
    start = startOfDay(anchor);
    start.setDate(1);
    end = new Date(start);
    end.setMonth(end.getMonth() + 1); // exclusive: 1st of next month
  } else {
    // yearly: January 1 00:00:00 through December 31 23:59:59
    start = startOfDay(anchor);
    start.setMonth(0, 1);
    end = new Date(start);
    end.setFullYear(end.getFullYear() + 1); // exclusive: Jan 1 next year
  }

  // Human-readable end date for display (end - 1 ms = last moment of period)
  const displayEnd = new Date(end.getTime() - 1);

  return {
    period: selectedPeriod,
    start,
    end,        // exclusive upper bound (used with $lt)
    label: selectedPeriod[0].toUpperCase() + selectedPeriod.slice(1),
    fileName: `${selectedPeriod[0].toUpperCase() + selectedPeriod.slice(1)}_Report`,
    dateRangeDisplay: `${formatDMY(start)} - ${formatDMY(displayEnd)}`
  };
}

async function buildReport(email, name, period, dateValue, userEmail) {
  const range = getPeriodRange(period, dateValue);
  const expenses = await db.getExpensesInRange(email, range.start, range.end);

  // Reports are expense-only. Income/salary entries are intentionally excluded.
  const transactions = expenses
    .filter((expense) => {
      const type = String(expense.type || "").toLowerCase();
      const category = String(expense.category || "").toLowerCase();
      return type !== "income" && category !== "salary";
    })
    .map((expense) => ({
      ...expense,
      type: "Expense"
    }));

  const totalExpense = transactions.reduce(
    (sum, transaction) => sum + (Number(transaction.amount) || 0),
    0
  );

  return {
    userName: name || "User",
    userEmail: userEmail || email || "",
    period: range.period,
    periodLabel: range.label,
    fileName: range.fileName,
    start: range.start,
    end: range.end,
    dateRange: range.dateRangeDisplay,
    transactions,
    totalExpense: Number(totalExpense.toFixed(2))
  };
}

module.exports = { PERIODS, getPeriodRange, buildReport };
