// Ensure global crypto is defined for older Node environments/packages
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = require("crypto").webcrypto || require("crypto");
}

// Your existing code continues below...
//const express = require("express");
// ...
const express = require("express");
const cors = require("cors"); // 1. Require CORS
const app = express();

app.use(cors()); // 2. Enable CORS for all incoming frontend requests
app.use(express.json());
const mongoose = require("mongoose");
require("dotenv").config();

const { createApp } = require("./app");
const Transaction = require("./Transaction");

const PORT = process.env.PORT || 3001;

async function start() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Database connected");

  const app = createApp({ Transaction });
  const server = app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

start().catch((error) => {
  console.error("Unable to start server:", error.message);
  process.exit(1);
});
