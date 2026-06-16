import mongoose from "mongoose";
import { DEFAULT_CONFIGURATION } from "./_configuration.js";

const TransactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Amount must be greater than zero.",
      },
    },
    category: {
      type: String,
      enum: ["Expense", "Conversion"],
      required: true,
    },
    from: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    inChargeOfWithdrawal: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    to: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    currency: {
      type: String,
      enum: DEFAULT_CONFIGURATION.currencies,
      required: true,
    },
    rate: {
      type: Number,
      default: 1,
      validate: {
        validator: (value) => Number.isFinite(value) && value > 0,
        message: "Rate must be greater than zero.",
      },
    },
    status: {
      type: String,
      enum: ["Pending", "Completed"],
      default: "Completed",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
  },
  { timestamps: true, versionKey: false },
);

export const Transaction =
  mongoose.models.Transaction ||
  mongoose.model("Transaction", TransactionSchema);

const allowedFields = [
  "date",
  "amount",
  "category",
  "from",
  "inChargeOfWithdrawal",
  "to",
  "currency",
  "rate",
  "status",
  "notes",
];

export const listTransactions = () =>
  Transaction.find().sort({ date: -1, createdAt: -1 }).lean();

export const createTransaction = async (body = {}) => {
  const transaction = await Transaction.create(
    Object.fromEntries(
      allowedFields
        .filter((field) => body[field] !== undefined)
        .map((field) => [field, body[field]]),
    ),
  );

  return transaction.toObject();
};
