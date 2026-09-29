const PDFDocument = require("pdfkit");

// Always format as DD/MM/YYYY (locale-independent)
function formatDateDMY(dateValue) {
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function createPdfReport(report) {
  return new Promise((resolve, reject) => {
    const document = new PDFDocument({ size: "A4", margin: 40 });
    const chunks = [];
    document.on("data", (chunk) => chunks.push(chunk));
    document.on("end",  () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);

    // -----------------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------------
    document.fontSize(20).fillColor("#17212b").text("Expense Tracker Report");
    document.moveDown(0.35);
    document.fontSize(10).fillColor("#58636d").text(`User: ${report.userName}`);
    if (report.userEmail) {
      document.text(`Email: ${report.userEmail}`);
    }
    document.text(`Period: ${report.periodLabel} | ${report.dateRange}`);
    document.moveDown(0.75);

    // -----------------------------------------------------------------------
    // KPI card — expense-only report
    // -----------------------------------------------------------------------
    const cardY = document.y;
    const cardWidth = document.page.width - 80;
    document.roundedRect(40, cardY, cardWidth, 52, 6).fill("#fff3f1");
    document.fillColor("#b02a37").fontSize(9).text("TOTAL EXPENSE", 50, cardY + 10, { width: cardWidth - 20 });
    document.fillColor("#b02a37").fontSize(16).text(
      `\u20B9${Number(report.totalExpense).toFixed(2)}`,
      50,
      cardY + 26,
      { width: cardWidth - 20 }
    );

    document.y = cardY + 68;
    document.moveDown(0.5);

    // -----------------------------------------------------------------------
    // Transaction table
    // -----------------------------------------------------------------------
    const columns = [
      ["Date",        72],
      ["Description", 190],
      ["Category",    130],
      ["Amount",      110]
    ];

    const TABLE_X     = 40;
    const PAGE_BOTTOM = document.page.height - document.page.margins.bottom - 10;
    const ROW_HEIGHT  = 20;
    const HEADER_H    = 22;

    function drawHeaderRow() {
      const y = document.y;
      document.rect(TABLE_X, y - 4, 502, HEADER_H).fill("#e9ecef");
      let x = TABLE_X;
      columns.forEach(([label, width]) => {
        document.fillColor("#17212b").fontSize(8)
          .text(String(label), x, y, { width, ellipsis: true });
        x += width;
      });
      document.y = y + ROW_HEIGHT;
    }

    function drawDataRow(values) {
      const y = document.y;
      let x = TABLE_X;
      values.forEach((value, index) => {
        document.fillColor("#343a40").fontSize(8)
          .text(String(value), x, y, { width: columns[index][1], ellipsis: true });
        x += columns[index][1];
      });
      document.y = y + ROW_HEIGHT;
    }

    drawHeaderRow();

    report.transactions.forEach((transaction) => {
      if (document.y + ROW_HEIGHT > PAGE_BOTTOM) {
        document.addPage();
        document.y = 40;
        drawHeaderRow();
      }
      drawDataRow([
        formatDateDMY(transaction.createdAt),
        transaction.description,
        transaction.category || "Other",
        `\u20B9${Number(transaction.amount).toFixed(2)}`
      ]);
    });

    document.end();
  });
}

module.exports = { createPdfReport };
