import express from "express";

import configuration from "./api/configuration.js";
import login from "./api/login.js";
import logout from "./api/logout.js";
import password from "./api/password.js";
import session from "./api/session.js";
import settings from "./api/settings.js";
import transactions from "./api/transactions.js";
import username from "./api/username.js";
import { isAllowedOrigin } from "./api/_cors.js";

const asyncHandler = (handler) => async (request, response, next) => {
  try {
    await handler(request, response);
  } catch (error) {
    next(error);
  }
};

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use((request, response, next) => {
    const origin = request.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Access-Control-Allow-Credentials", "true");
      response.setHeader(
        "Access-Control-Allow-Headers",
        request.headers["access-control-request-headers"] || "Content-Type",
      );
      response.setHeader(
        "Access-Control-Allow-Methods",
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      response.setHeader("Vary", "Origin");
    }

    if (request.method === "OPTIONS") {
      response.status(204).end();
      return;
    }

    next();
  });
  app.use(express.json({ limit: "100kb" }));

  app.get("/healthz", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json({ status: "ok" });
  });

  app.post("/api/login", asyncHandler(login));
  app.post("/api/logout", asyncHandler(logout));
  app.get("/api/session", asyncHandler(session));
  app.get("/api/settings", asyncHandler(settings));
  app.put("/api/settings", asyncHandler(settings));
  app.get("/api/configuration", asyncHandler(configuration));
  app.get("/api/transactions", asyncHandler(transactions));
  app.post("/api/transactions", asyncHandler(transactions));
  app.put("/api/password", asyncHandler(password));
  app.put("/api/username", asyncHandler(username));

  app.use("/api", (_request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.status(404).json({ error: "API endpoint not found." });
  });

  app.use((error, _request, response, _next) => {
    console.error("Unhandled API error:", error.message);
    response.setHeader("Cache-Control", "no-store");
    response.status(500).json({ error: "Internal server error." });
  });

  return app;
};

export default createApp();
