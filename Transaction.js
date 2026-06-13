const mongoose = require("mongoose");

const PIPELINES = [
  "Cash",
  "Lite",
  "Habesha",
  "Best",
  "Speed",
  "Santim",
  "Dash",
  "Dama",
];

const TransactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      default: Date.now,
    },
    category: {
      type: String,
      required: true,
      enum: ["Expense", "Conversion"],
    },
    from: {
      type: String,
      required: true,
      enum: PIPELINES,
    },
    to: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },
    currency: {
      type: String,
      required: true,
      enum: ["USDT", "ETB", "USD"],
      default: "USDT",
    },
    rate: {
      type: Number,
      default: 1,
      min: [0.000001, "Exchange rate must be greater than zero"],
    },
    inChargeOfWithdrawal: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: ["Completed", "Pending"],
      default: "Pending",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Transaction", TransactionSchema);
