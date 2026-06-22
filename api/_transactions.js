import mongoose from "mongoose";
import { DEFAULT_CONFIGURATION } from "./_configuration.js";
import { hasAnyPermission, isAdmin } from "./_users.js";

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
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
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

const transactionScope = (user) =>
  isAdmin(user) || hasAnyPermission(user, ["transactions:read_all", "reports:view_all"])
    ? {}
    : { createdBy: user._id };

export const listTransactions = (user) =>
  Transaction.find(transactionScope(user)).sort({ date: -1, createdAt: -1 }).lean();

export const createTransaction = async (body = {}, user) => {
  const transaction = await Transaction.create(
    {
      ...Object.fromEntries(
        allowedFields
          .filter((field) => body[field] !== undefined)
          .map((field) => [field, body[field]]),
      ),
      createdBy: user?._id,
    },
  );

  return transaction.toObject();
};
