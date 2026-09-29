const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  // Optional for backwards compatibility with existing email-owned records.
  // New records also retain the authenticated user's immutable database id.
  userId: {
    type: String,
    default: null,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  expenseDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  categorySource: {
    type: String,
    default: "fallback"
  },
  aiSuggested: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Covers the paginated user query with a stable newest-first tie-breaker.
expenseSchema.index({ email: 1, createdAt: -1, _id: -1 });
expenseSchema.index({ id: 1 });

module.exports = mongoose.models.Expense || mongoose.model("Expense", expenseSchema);
