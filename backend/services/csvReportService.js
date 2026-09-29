function csvCell(value) {
  let safeValue = String(value ?? "");
  if (/^[=+\-@]/.test(safeValue)) safeValue = `'${safeValue}`;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

// Always format as DD/MM/YYYY (locale-independent)
function formatDateDMY(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function createCsvReport(report) {
  const rows = [
    ["User Name",       report.userName],
    ["Selected Period", report.periodLabel],
    ["Date Range",      report.dateRange],
    ["Total Expense",   report.totalExpense.toFixed(2)],
    [],
    ["Date", "Description", "Category", "Amount (INR)"],
    ...report.transactions.map((transaction) => [
      formatDateDMY(transaction.createdAt),
      transaction.description,
      transaction.category || "Other",
      transaction.amount.toFixed(2)
    ])
  ];

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
}

module.exports = { createCsvReport };