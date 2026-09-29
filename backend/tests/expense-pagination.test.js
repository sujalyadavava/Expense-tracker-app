const assert = require("node:assert/strict");
const test = require("node:test");
const { once } = require("node:events");

process.env.JWT_SECRET = "pagination-test-secret";
const database = require("../config/database");
database.connectDB = async () => true;

const jwt = require("jsonwebtoken");
const Expense = require("../models/Expense");
const db = require("../utils/db");
const controller = require("../controllers/expenseController");
const app = require("../app");

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("expense API pages only the authenticated user's rows and clamps invalidated pages", async () => {
  const originalFind = Expense.find;
  const originalCountDocuments = Expense.countDocuments;
  const originalAggregate = Expense.aggregate;
  let rowCount = 47;
  let query;
  let totalAmount = 1234.5;
  let countFilter;
  let aggregateFilter;

  Expense.countDocuments = async (filter) => {
    countFilter = filter;
    return rowCount;
  };
  Expense.aggregate = async ([match]) => {
    aggregateFilter = match.$match;
    return totalAmount ? [{ totalAmount }] : [];
  };
  Expense.find = (filter) => {
    query = { filter };
    return {
      select() { return this; },
      sort(value) { query.sort = value; return this; },
      skip(value) { query.skip = value; return this; },
      limit(value) { query.limit = value; return this; },
      async lean() {
        const rowsOnPage = Math.max(0, Math.min(query.limit, rowCount - query.skip));
        return Array.from({ length: rowsOnPage }, (_, index) => ({
          id: query.skip + index + 1,
          amount: query.skip + index + 1,
          description: `Expense ${query.skip + index + 1}`,
          category: "Other",
          createdAt: new Date()
        }));
      }
    };
  };

  try {
    const response = createResponse();
    await controller.getExpenses({
      user: { email: "Owner@Example.com" },
      query: { page: "5", limit: "20", email: "attacker@example.com" }
    }, response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.deepEqual(countFilter, { email: "owner@example.com" });
    assert.deepEqual(aggregateFilter, countFilter);
    assert.deepEqual(query.filter, countFilter);
    assert.deepEqual(query.sort, { createdAt: -1, _id: -1 });
    assert.equal(query.skip, 40);
    assert.equal(query.limit, 20);
    assert.equal(response.body.expenses.length, 7);
    assert.deepEqual(response.body.pagination, {
      currentPage: 3,
      pageSize: 20,
      totalExpenses: 47,
      totalPages: 3,
      hasNextPage: false,
      hasPreviousPage: true
    });
    assert.equal(response.body.totalAmount, 1234.5);

    for (const count of [1, 7, 10, 11, 20, 21, 100]) {
      rowCount = count;
      const boundaryResponse = createResponse();
      await controller.getExpenses({ user: { email: "owner@example.com" }, query: {} }, boundaryResponse);
      assert.equal(boundaryResponse.body.pagination.totalExpenses, count);
      assert.equal(boundaryResponse.body.pagination.totalPages, Math.ceil(count / 10));
      assert.equal(boundaryResponse.body.expenses.length, Math.min(count, 10));
      assert.equal(boundaryResponse.body.pagination.hasNextPage, count > 10);
    }

    rowCount = 0;
    totalAmount = 0;
    const emptyResponse = createResponse();
    await controller.getExpenses({ user: { email: "owner@example.com" }, query: { page: "4", limit: "5" } }, emptyResponse);
    assert.equal(emptyResponse.body.expenses.length, 0);
    assert.equal(emptyResponse.body.pagination.currentPage, 1);
    assert.equal(emptyResponse.body.pagination.totalPages, 0);
    assert.equal(emptyResponse.body.pagination.hasPreviousPage, false);

    const invalidResponse = createResponse();
    await controller.getExpenses({ user: { email: "owner@example.com" }, query: { page: "1", limit: "8" } }, invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);

    rowCount = 47;
    totalAmount = 1234.5;
    const originalGetUser = db.getUser;
    db.getUser = async (email) => ({ id: "owner-id", email, name: "Owner" });
    const server = app.listen(0);
    await once(server, "listening");
    try {
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      const unauthorized = await fetch(`${baseUrl}/api/expenses`);
      assert.equal(unauthorized.status, 401);

      const token = jwt.sign({ id: "owner-id", email: "owner@example.com" }, process.env.JWT_SECRET);
      const protectedResponse = await fetch(`${baseUrl}/api/expenses?page=5&limit=20&email=attacker%40example.com`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const protectedBody = await protectedResponse.json();
      assert.equal(protectedResponse.status, 200);
      assert.deepEqual(query.filter, { email: "owner@example.com" });
      assert.equal(protectedBody.pagination.currentPage, 3);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      db.getUser = originalGetUser;
    }
  } finally {
    Expense.find = originalFind;
    Expense.countDocuments = originalCountDocuments;
    Expense.aggregate = originalAggregate;
  }
});