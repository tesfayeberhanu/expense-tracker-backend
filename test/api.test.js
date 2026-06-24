import assert from "node:assert/strict";
import process from "node:process";
import test from "node:test";

import { clearSessionCookie } from "../api/_auth.js";
import { DEFAULT_CONFIGURATION } from "../api/_configuration.js";
import { isAllowedOrigin } from "../api/_cors.js";
import { Transaction } from "../api/_transactions.js";
import {
  DEFAULT_OPERATOR_PERMISSIONS,
  ensureBootstrapUser,
  hasPermission,
  hashPassword,
  normalizePermissions,
  passwordMatches,
  PERMISSIONS,
  publicUser,
  ROLES,
  User,
  validateUsername,
} from "../api/_users.js";
import configuration from "../api/configuration.js";
import login from "../api/login.js";
import logout from "../api/logout.js";
import operators from "../api/operators.js";
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
    [operators, request("GET")],
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
    [operators, request("POST", crossSiteHeaders, {})],
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
  process.env.CORS_ORIGINS = "https://client.example.com";

  assert.equal(isAllowedOrigin("https://lbk-finance.vercel.app"), true);
  assert.equal(isAllowedOrigin("https://tbk-expense-tracker.vercel.app"), true);
  assert.equal(isAllowedOrigin("http://localhost:5173"), true);
  assert.equal(isAllowedOrigin("http://localhost:5174"), true);
  assert.equal(isAllowedOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isAllowedOrigin("https://client.example.com"), true);
  assert.equal(isAllowedOrigin("https://client.example.com/"), true);
  assert.equal(isAllowedOrigin("https://random-app.example.com"), false);
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

test("normalizes and validates operator permissions", () => {
  assert.deepEqual(
    normalizePermissions(["transactions:create", "transactions:create", "reports:view"]),
    ["transactions:create", "reports:view"],
  );
  assert.throws(
    () => normalizePermissions(["unknown:permission"]),
    /Unsupported permission/,
  );
});

test("admin users receive every permission in public session bodies", () => {
  const user = publicUser({
    _id: "6a2c718e606456f8dc61485e",
    username: "admin",
    role: ROLES.ADMIN,
    active: true,
    permissions: [],
  });

  assert.equal(hasPermission(user, "operators:manage"), true);
  assert.deepEqual(user.permissions, PERMISSIONS);
});

test("operator users keep only assigned permissions", () => {
  const user = publicUser({
    _id: "6a2c718e606456f8dc61485e",
    username: "operator",
    role: ROLES.OPERATOR,
    active: true,
    permissions: DEFAULT_OPERATOR_PERMISSIONS,
  });

  assert.equal(hasPermission(user, "transactions:create"), true);
  assert.equal(hasPermission(user, "operators:manage"), false);
});

test("default configuration includes PA operator option", () => {
  assert.equal(DEFAULT_CONFIGURATION.pipelines.includes("PA"), true);
});

test("bootstrap user resets existing admin password", async () => {
  const originalUsername = process.env.BOOTSTRAP_USERNAME;
  const originalPassword = process.env.BOOTSTRAP_PASSWORD;

  process.env.BOOTSTRAP_USERNAME = "admin";
  process.env.BOOTSTRAP_PASSWORD = "new-secure-password";

  const savedUsers = [];
  const originalFindOne = User.findOne;

  User.findOne = async () => ({
    username: "admin",
    passwordHash: hashPassword("old-secure-password"),
    role: ROLES.OPERATOR,
    permissions: [],
    active: false,
    async save() {
      savedUsers.push(this);
    },
  });

  try {
    await ensureBootstrapUser();
  } finally {
    User.findOne = originalFindOne;
    process.env.BOOTSTRAP_USERNAME = originalUsername;
    process.env.BOOTSTRAP_PASSWORD = originalPassword;
  }

  assert.equal(savedUsers.length, 1);
  assert.equal(savedUsers[0].role, ROLES.ADMIN);
  assert.equal(savedUsers[0].active, true);
  assert.equal(passwordMatches("new-secure-password", savedUsers[0].passwordHash), true);
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
