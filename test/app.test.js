const assert = require("node:assert/strict");
const { beforeEach, test } = require("node:test");

const { createApp } = require("../app");

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

const app = createApp({ Transaction: FakeTransaction });

beforeEach(() => {
  FakeTransaction.records = [];
  FakeTransaction.nextId = 1;
});

function routeHandler(path, method) {
  const layer = app.router.stack.find(
    (item) => item.route?.path === path && item.route.methods[method],
  );
  return layer.route.stack[0].handle;
}

function responseMock() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function failOnNext(error) {
  throw error;
}

test("lists transactions", async () => {
  FakeTransaction.records = [{ _id: "1", amount: 100 }];
  const response = responseMock();

  await routeHandler("/api/transactions", "get")({}, response, failOnNext);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, FakeTransaction.records);
});

test("creates a transaction and ignores unexpected fields", async () => {
  const response = responseMock();

  await routeHandler("/api/transactions", "post")(
    {
      body: {
      amount: 100,
      category: "Expense",
      unexpected: "do not store me",
      },
    },
    response,
    failOnNext,
  );

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.amount, 100);
  assert.equal(response.body.unexpected, undefined);
});

test("toggles transaction status", async () => {
  FakeTransaction.records = [{ _id: "1", status: "Pending", save: async () => {} }];
  const response = responseMock();

  await routeHandler("/api/transactions/:id/toggle", "patch")(
    { params: { id: "1" } },
    response,
    failOnNext,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.status, "Completed");
});

test("returns a useful response when a transaction is missing", async () => {
  const response = responseMock();

  await routeHandler("/api/transactions/:id", "delete")(
    { params: { id: "missing" } },
    response,
    failOnNext,
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, { error: "Transaction not found" });
});
