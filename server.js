// Ensure global crypto is defined for older Node environments/packages.
if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = require("node:crypto").webcrypto;
}

const mongoose = require("mongoose");
require("dotenv").config();

const { createApp } = require("./app");
const Transaction = require("./Transaction");

const PORT = process.env.PORT || 3001;
const app = createApp({ Transaction });

async function connectDatabase() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is required");
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Database connected");
  }
}

if (require.main === module) {
  connectDatabase()
    .then(() => {
      const server = app.listen(PORT, () => {
        console.log(`Server listening on http://localhost:${PORT}`);
      });

      const shutdown = (signal) => {
        console.log(`${signal} received, shutting down`);
        server.close(async () => {
          await mongoose.disconnect();
          process.exit(0);
        });
      };

      process.on("SIGINT", () => shutdown("SIGINT"));
      process.on("SIGTERM", () => shutdown("SIGTERM"));
    })
    .catch((error) => {
      console.error("Unable to start server:", error.message);
      process.exit(1);
    });
} else {
  connectDatabase().catch((error) => {
    console.error("Unable to connect to database:", error.message);
  });
}

module.exports = app;
