const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    default: 199,
    min: 199,
    max: 199
  },
  status: {
    type: String,
    enum: ["PENDING", "SUCCESSFUL", "FAILED"],
    default: "PENDING"
  },
  paymentSessionId: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  }
}, { timestamps: true });

orderSchema.index({ email: 1, createdAt: -1 });

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema);