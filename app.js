const path = require("node:path");
const cors = require("cors");
const express = require("express");
const mongoose = require("mongoose");

const ALLOWED_FIELDS = [
  "date",
  "category",
  "from",
  "to",
  "amount",
  "currency",
  "rate",
  "inChargeOfWithdrawal",
  "status",
  "notes",
];

function selectAllowedFields(body) {
  return Object.fromEntries(
    ALLOWED_FIELDS.filter((field) => body[field] !== undefined).map((field) => [
      field,
      body[field],
    ]),
  );
}

function createApp({ Transaction }) {
  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;

  app.disable("x-powered-by");
  app.use(cors(corsOrigin ? { origin: corsOrigin } : undefined));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.get("/api/health", (_req, res) => {
    const database =
      mongoose.connection.readyState === 1 ? "connected" : "disconnected";
    res.json({ status: "ok", database });
  });

  app.get("/api/transactions", async (_req, res, next) => {
    try {
      const transactions = await Transaction.find()
        .sort({ date: -1, createdAt: -1 })
        .lean();
      res.json(transactions);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/transactions", async (req, res, next) => {
    try {
      const transaction = new Transaction(selectAllowedFields(req.body));
      const savedTransaction = await transaction.save();
      res.status(201).json(savedTransaction);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/transactions/:id", async (req, res, next) => {
    try {
      const deletedTransaction = await Transaction.findByIdAndDelete(
        req.params.id,
      );
      if (!deletedTransaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      return res.json({ message: "Transaction deleted" });
    } catch (error) {
      return next(error);
    }
  });

  app.patch("/api/transactions/:id/toggle", async (req, res, next) => {
    try {
      const transaction = await Transaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      transaction.status =
        transaction.status === "Pending" ? "Completed" : "Pending";
      await transaction.save();
      return res.json(transaction);
    } catch (error) {
      return next(error);
    }
  });

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API endpoint not found" });
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof mongoose.Error.ValidationError) {
      const details = Object.values(error.errors).map((item) => item.message);
      return res.status(400).json({ error: "Validation failed", details });
    }
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ error: "Invalid transaction ID" });
    }

    console.error(error);
    return res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

module.exports = { createApp };
