const assert = require("node:assert/strict");
const { afterEach, beforeEach, test } = require("node:test");

const appModule = require("../app");
const { createApp } = appModule;
const { createAuth, hashPassword } = require("../auth");

const PASSWORD = "a-secure-test-password";
const SECRET = "a-test-session-secret-that-is-longer-than-32-characters";

class FakeTransaction {
  static records = [];
  static nextId = 1;

  constructor(data) {
    Object.assign(this, data);
    this._id = String(FakeTransaction.nextId++);
  }

  async save() {
    const existingIndex = FakeTransaction.records.findIndex(
      (record) => record._id === this._id,
    );
    if (existingIndex >= 0) {
      FakeTransaction.records[existingIndex] = this;
    } else {
      FakeTransaction.records.push(this);
    }
    return this;
  }

  static find() {
    return {
      sort() {
        return {
          async lean() {
            return FakeTransaction.records;
          },
        };
      },
    };
  }

  static async findById(id) {
    return FakeTransaction.records.find((record) => record._id === id) || null;
  }

  static async findByIdAndDelete(id) {
    const index = FakeTransaction.records.findIndex(
      (record) => record._id === id,
    );
    return index >= 0 ? FakeTransaction.records.splice(index, 1)[0] : null;
  }
}

let server;
let baseUrl;

test("exports a Vercel-compatible default handler", () => {
  assert.equal(typeof appModule, "function");
});

beforeEach(async () => {
  FakeTransaction.records = [];
  FakeTransaction.nextId = 1;

  const auth = createAuth({
    username: "admin",
    passwordHash: hashPassword(PASSWORD),
    secret: SECRET,
  });
  const app = createApp({ Transaction: FakeTransaction, auth });

  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

async function login(password = PASSWORD) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password }),
  });
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  return { cookie, response };
}

test("protects all private API endpoints", async () => {
  const privateRequests = [
    { path: "/api/health" },
    { path: "/api/transactions" },
    { path: "/api/transactions", options: { method: "POST" } },
    { path: "/api/transactions/1", options: { method: "DELETE" } },
    { path: "/api/transactions/1/toggle", options: { method: "PATCH" } },
    { path: "/api/auth/session" },
    { path: "/api/auth/logout", options: { method: "POST" } },
    { path: "/api/not-a-real-endpoint" },
  ];

  for (const { path, options } of privateRequests) {
    const response = await fetch(`${baseUrl}${path}`, options);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Authentication required",
    });
  }
});

test("exposes only the login page and login API without authentication", async () => {
  const pageResponse = await fetch(baseUrl);
  assert.equal(pageResponse.status, 200);
  assert.match(pageResponse.headers.get("content-type"), /text\/html/);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "wrong-password" }),
  });
  assert.equal(loginResponse.status, 401);
  assert.deepEqual(await loginResponse.json(), {
    error: "Invalid username or password",
  });
});

test("logs in with a secure cookie and grants access", async () => {
  FakeTransaction.records = [{ _id: "1", amount: 100 }];

  const { cookie, response: loginResponse } = await login();
  const setCookie = loginResponse.headers.get("set-cookie");
  assert.equal(loginResponse.status, 200);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);

  const response = await fetch(`${baseUrl}/api/transactions`, {
    headers: { Cookie: cookie },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), FakeTransaction.records);
});

test("rejects invalid credentials", async () => {
  const { response } = await login("wrong-password");

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.deepEqual(await response.json(), {
    error: "Invalid username or password",
  });
});

test("throttles repeated login failures", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { response } = await login("wrong-password");
    assert.equal(response.status, 401);
  }

  const { response } = await login("wrong-password");
  assert.equal(response.status, 429);
  assert.ok(response.headers.get("retry-after"));
});

test("rejects a tampered session cookie", async () => {
  const { cookie } = await login();
  const response = await fetch(`${baseUrl}/api/transactions`, {
    headers: { Cookie: `${cookie}tampered` },
  });

  assert.equal(response.status, 401);
});

test("supports authenticated transaction changes", async () => {
  const { cookie } = await login();
  const headers = {
    Cookie: cookie,
    "Content-Type": "application/json",
  };

  const createResponse = await fetch(`${baseUrl}/api/transactions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      amount: 100,
      category: "Expense",
      unexpected: "do not store me",
    }),
  });
  assert.equal(createResponse.status, 201);
  const transaction = await createResponse.json();
  assert.equal(transaction.unexpected, undefined);

  const toggleResponse = await fetch(
    `${baseUrl}/api/transactions/${transaction._id}/toggle`,
    { method: "PATCH", headers: { Cookie: cookie } },
  );
  assert.equal(toggleResponse.status, 200);
  assert.equal((await toggleResponse.json()).status, "Pending");

  const deleteResponse = await fetch(
    `${baseUrl}/api/transactions/${transaction._id}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );
  assert.equal(deleteResponse.status, 200);
});

test("rejects cross-site state-changing requests", async () => {
  const { cookie } = await login();
  const response = await fetch(`${baseUrl}/api/transactions`, {
    method: "POST",
    headers: {
      Cookie: cookie,
      "Content-Type": "application/json",
      Origin: "https://attacker.example",
    },
    body: JSON.stringify({ amount: 100 }),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: "Cross-site request rejected",
  });
});
