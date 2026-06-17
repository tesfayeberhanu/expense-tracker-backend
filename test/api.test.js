import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { clearSessionCookie } from "../api/_auth.js";
import { isAllowedOrigin } from "../api/_cors.js";
import { Transaction } from "../api/_transactions.js";
import { hashPassword, passwordMatches, validateUsername } from "../api/_users.js";
import configuration from "../api/configuration.js";
import login from "../api/login.js";
import logout from "../api/logout.js";
import password from "../api/password.js";
import session from "../api/session.js";
import settings from "../api/settings.js";
import transactions from "../api/transactions.js";
import username from "../api/username.js";

const request = (method, headers = {}, body) => ({
  method,
  headers: {
    host: "finance.example.com",
    "x-forwarded-proto": "https",
    ...headers,
  },
  body,
});

const response = () => ({
  body: undefined,
  headers: new Map(),
  statusCode: undefined,
  setHeader(name, value) {
    this.headers.set(name.toLowerCase(), value);
  },
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
  send(body) {
    this.body = body;
    return this;
  },
});

test("rejects unauthenticated private API requests", async () => {
  for (const [handler, apiRequest] of [
    [session, request("GET")],
    [logout, request("POST")],
    [settings, request("GET")],
    [configuration, request("GET")],
    [transactions, request("GET")],
  ]) {
    const apiResponse = response();
    await handler(apiRequest, apiResponse);
    assert.equal(apiResponse.statusCode, 401);
  }
});

test("creates a cookie that clears the database session token", () => {
  assert.match(clearSessionCookie(), /^lp_session=;/);
  assert.match(clearSessionCookie(), /Max-Age=0/);
});

test("rejects cross-site state-changing requests", async () => {
  const crossSiteHeaders = {
    origin: "https://attacker.example",
    "sec-fetch-site": "cross-site",
  };

  for (const [handler, apiRequest] of [
    [login, request("POST", crossSiteHeaders, {})],
    [logout, request("POST", crossSiteHeaders)],
    [settings, request("PUT", crossSiteHeaders, {})],
    [transactions, request("POST", crossSiteHeaders, {})],
    [password, request("PUT", crossSiteHeaders, {})],
    [username, request("PUT", crossSiteHeaders, {})],
  ]) {
    const apiResponse = response();
    await handler(apiRequest, apiResponse);
    assert.equal(apiResponse.statusCode, 403);
    assert.deepEqual(apiResponse.body, {
      error: "Cross-site request rejected.",
    });
  }
});

test("allows only configured CORS origins", () => {
  process.env.CORS_ORIGINS =
    "http://localhost:5173,https://client.example.com";

  assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(
    isAllowedOrigin("https://expense-tracker-frontend-lyplbb0ib.vercel.app"),
    true,
  );
  assert.equal(isAllowedOrigin("https://client.example.com"), true);
  assert.equal(isAllowedOrigin("https://client.example.com/"), true);
  assert.equal(isAllowedOrigin("https://attacker.example"), false);
});

test("rejects direct browser navigation to transactions", async () => {
  const apiResponse = response();

  await transactions(
    request("GET", {
      accept: "text/html,application/xhtml+xml",
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
    }),
    apiResponse,
  );

  assert.equal(apiResponse.statusCode, 404);
  assert.deepEqual(apiResponse.body, { error: "API endpoint not found." });
});

test("hashes passwords before storing them", () => {
  const password = "a-secure-test-password";
  const hash = hashPassword(password);

  assert.notEqual(hash, password);
  assert.equal(passwordMatches(password, hash), true);
  assert.equal(passwordMatches("incorrect-password", hash), false);
});

test("normalizes and validates usernames", () => {
  assert.equal(validateUsername(" Leo "), "leo");
  assert.throws(() => validateUsername("not allowed"), /Username must contain/);
});

test("validates transaction records before MongoDB persistence", async () => {
  const transaction = new Transaction({
    date: "2026-06-15",
    amount: -10,
    category: "Expense",
    from: "Cash",
    inChargeOfWithdrawal: "Operator",
    to: "Vendor",
    currency: "ETB",
  });

  await assert.rejects(transaction.validate(), /Amount must be greater than zero/);
});
