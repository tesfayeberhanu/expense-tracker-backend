const path = require("node:path");
const express = require("express");
const mongoose = require("mongoose");

const { createAuthFromEnvironment } = require("./auth");

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

function requireSameOrigin(req, res, next) {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) {
    return next();
  }

  const origin = req.get("origin");
  const crossSite = req.get("sec-fetch-site") === "cross-site";
  if (
    crossSite ||
    (origin && origin !== `${req.protocol}://${req.get("host")}`)
  ) {
    return res.status(403).json({ error: "Cross-site request rejected" });
  }

  return next();
}

function securityHeaders(req, res, next) {
  res.set({
    "Content-Security-Policy":
      "default-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  if (process.env.NODE_ENV === "production") {
    res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return next();
}

function createApp({ Transaction, auth = createAuthFromEnvironment() }) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(securityHeaders);
  app.use(express.json({ limit: "100kb" }));
  app.use(
    express.static(path.join(__dirname, "public"), {
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) {
          res.set("Cache-Control", "no-store");
        }
      },
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", requireSameOrigin);

  app.post("/api/auth/login", auth.login);
  app.post("/api/auth/logout", auth.logout);
  app.get("/api/auth/session", auth.requireAuth, auth.session);

  app.use("/api", auth.requireAuth);

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
    if (error instanceof SyntaxError && error.status === 400) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
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
