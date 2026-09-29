const db = require("../utils/db");
const { categorizeExpense, spendingInsight } = require("../services/aiService");

// POST /api/ai/categorize   (auth optional — used from expense form before saving)
// POST /api/categorize-expense  (legacy alias)
exports.categorize = async (req, res) => {
  try {
    const description = String(req.body.description || "").trim();
    if (!description) {
      return res.status(400).json({ success: false, message: "Description is required." });
    }
    const result = await categorizeExpense(description);
    // Return both the standard shape and a success flag for clarity.
    return res.json({ success: true, category: result.category, source: result.source });
  } catch (e) {
    console.error("ai categorize error:", e.message);
    return res.status(500).json({ success: false, message: "AI categorization failed. Please try again." });
  }
};

// GET /api/ai/insight   (auth required — analyzes logged-in user's expenses)
exports.insight = async (req, res) => {
  try {
    // req.user is guaranteed by the required auth middleware on this route.
    const email = req.user?.email;
    if (!email) {
      return res.status(401).json({ success: false, message: "Authentication required." });
    }

    const expenses = await db.getExpenses(email);

    if (!expenses.length) {
      return res.json({
        success: true,
        insight: "No expenses recorded yet. Start adding expenses to receive personalised AI insights.",
        tip:     "Track at least a week of expenses to see spending patterns.",
        source:  "local"
      });
    }

    const result = await spendingInsight(expenses);

    // Build a simple tip based on top category when AI insight is local.
    let tip = "";
    if (result.source === "local") {
      const totals = {};
      expenses.forEach(e => { totals[e.category] = (totals[e.category] || 0) + Number(e.amount); });
      const top = Object.keys(totals).sort((a, b) => totals[b] - totals[a])[0];
      tip = `Consider reviewing your ${top} spending to find potential savings.`;
    } else {
      tip = "Review your spending habits regularly to stay on budget.";
    }

    return res.json({
      success: true,
      insight: result.text,
      tip,
      source: result.source
    });
  } catch (e) {
    console.error("ai insight error:", e.message);
    return res.status(500).json({ success: false, message: "Could not generate insight. Please try again." });
  }
};
