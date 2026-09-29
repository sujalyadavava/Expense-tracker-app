const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { connectDB } = require("../config/database");
const User = require("../models/User");
const Expense = require("../models/Expense");
const Order = require("../models/Order");
const PasswordResetToken = require("../models/PasswordResetToken");

// Local fallback store path
const DATA_DIR = path.join(__dirname, "../../.data");
const LOCAL_DB_FILE = path.join(DATA_DIR, "db.json");

// Pre-seeded fallback data matching production dashboard & screenshot state
function getDefaultSeedData() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString().slice(0, 10);

  return {
    users: [
      {
        id: "usr_sujal98357",
        name: "sujal98357",
        email: "sujal98357@gmail.com",
        password: "$2b$10$w8uQ78k96fG3Vv84b00J8.rM9p6sJ8rL8nF5p8g4t3z1y6w8x7u2", // hashed password
        isPremium: true,
        ispremiumuser: true,
        createdAt: new Date("2026-09-01T00:00:00Z")
      },
      {
        id: "usr_sy1908412",
        name: "sy1908412",
        email: "sy1908412@gmail.com",
        password: "$2b$10$w8uQ78k96fG3Vv84b00J8.rM9p6sJ8rL8nF5p8g4t3z1y6w8x7u2",
        isPremium: true,
        ispremiumuser: true,
        createdAt: new Date("2026-09-02T00:00:00Z")
      },
      {
        id: "usr_demo",
        name: "Demo User",
        email: "demo@example.com",
        password: "$2b$10$w8uQ78k96fG3Vv84b00J8.rM9p6sJ8rL8nF5p8g4t3z1y6w8x7u2",
        isPremium: false,
        ispremiumuser: false,
        createdAt: new Date("2026-09-10T00:00:00Z")
      }
    ],
    expenses: [
      // sujal98357 expenses (total: 88,000 across 7 transactions)
      { id: 101, email: "sujal98357@gmail.com", amount: 25000, description: "MacBook Monitor & Desk Setup", category: "Shopping", categorySource: "user", aiSuggested: false, date: new Date("2026-09-20T10:00:00Z"), expenseDate: new Date("2026-09-20T10:00:00Z"), createdAt: new Date("2026-09-20T10:00:00Z") },
      { id: 102, email: "sujal98357@gmail.com", amount: 18000, description: "Quarterly Office Rent", category: "Bills", categorySource: "user", aiSuggested: false, date: new Date("2026-09-22T11:00:00Z"), expenseDate: new Date("2026-09-22T11:00:00Z"), createdAt: new Date("2026-09-22T11:00:00Z") },
      { id: 103, email: "sujal98357@gmail.com", amount: 15000, description: "Flight Tickets to Bengaluru", category: "Travel", categorySource: "ai", aiSuggested: true, date: new Date("2026-09-24T12:00:00Z"), expenseDate: new Date("2026-09-24T12:00:00Z"), createdAt: new Date("2026-09-24T12:00:00Z") },
      { id: 104, email: "sujal98357@gmail.com", amount: 12000, description: "Team Dinner at Sheraton", category: "Food", categorySource: "user", aiSuggested: false, date: new Date("2026-09-25T20:00:00Z"), expenseDate: new Date("2026-09-25T20:00:00Z"), createdAt: new Date("2026-09-25T20:00:00Z") },
      { id: 105, email: "sujal98357@gmail.com", amount: 8000, description: "Cloud Infrastructure Hosting", category: "Bills", categorySource: "ai", aiSuggested: true, date: new Date("2026-09-26T09:00:00Z"), expenseDate: new Date("2026-09-26T09:00:00Z"), createdAt: new Date("2026-09-26T09:00:00Z") },
      { id: 106, email: "sujal98357@gmail.com", amount: 6000, description: "AI Architecture Masterclass", category: "Education", categorySource: "user", aiSuggested: false, date: new Date("2026-09-27T14:00:00Z"), expenseDate: new Date("2026-09-27T14:00:00Z"), createdAt: new Date("2026-09-27T14:00:00Z") },
      { id: 107, email: "sujal98357@gmail.com", amount: 4000, description: "Uber Rides across city", category: "Transport", categorySource: "ai", aiSuggested: true, date: new Date(todayStr + "T14:00:00Z"), expenseDate: new Date(todayStr + "T14:00:00Z"), createdAt: new Date() },

      // sy1908412 expenses (total: 75,000 across 8 transactions)
      { id: 201, email: "sy1908412@gmail.com", amount: 20000, description: "Apple Watch Series 10", category: "Shopping", categorySource: "user", aiSuggested: false, date: new Date("2026-09-18T10:00:00Z"), expenseDate: new Date("2026-09-18T10:00:00Z"), createdAt: new Date("2026-09-18T10:00:00Z") },
      { id: 202, email: "sy1908412@gmail.com", amount: 16000, description: "Health Insurance Annual Premium", category: "Health", categorySource: "ai", aiSuggested: true, date: new Date("2026-09-21T10:00:00Z"), expenseDate: new Date("2026-09-21T10:00:00Z"), createdAt: new Date("2026-09-21T10:00:00Z") },
      { id: 203, email: "sy1908412@gmail.com", amount: 14000, description: "Weekend Resort Stay in Goa", category: "Travel", categorySource: "user", aiSuggested: false, date: new Date("2026-09-23T11:00:00Z"), expenseDate: new Date("2026-09-23T11:00:00Z"), createdAt: new Date("2026-09-23T11:00:00Z") },
      { id: 204, email: "sy1908412@gmail.com", amount: 9500, description: "Electricity & High-speed Fiber Bill", category: "Bills", categorySource: "user", aiSuggested: false, date: new Date("2026-09-25T15:00:00Z"), expenseDate: new Date("2026-09-25T15:00:00Z"), createdAt: new Date("2026-09-25T15:00:00Z") },
      { id: 205, email: "sy1908412@gmail.com", amount: 6200, description: "Fine Dining Dinner with Family", category: "Food", categorySource: "ai", aiSuggested: true, date: new Date("2026-09-27T20:30:00Z"), expenseDate: new Date("2026-09-27T20:30:00Z"), createdAt: new Date("2026-09-27T20:30:00Z") },
      { id: 206, email: "sy1908412@gmail.com", amount: 4500, description: "Concert tickets for weekend", category: "Entertainment", categorySource: "user", aiSuggested: false, date: new Date(twoDaysAgo + "T18:00:00Z"), expenseDate: new Date(twoDaysAgo + "T18:00:00Z"), createdAt: new Date(twoDaysAgo + "T18:00:00Z") },
      { id: 207, email: "sy1908412@gmail.com", amount: 2800, description: "Groceries & Daily Essentials", category: "Food", categorySource: "ai", aiSuggested: true, date: new Date(yesterday + "T12:00:00Z"), expenseDate: new Date(yesterday + "T12:00:00Z"), createdAt: new Date(yesterday + "T12:00:00Z") },
      { id: 208, email: "sy1908412@gmail.com", amount: 2000, description: "Lunch at Domino's", category: "Food", categorySource: "user", aiSuggested: false, date: new Date(todayStr + "T13:00:00Z"), expenseDate: new Date(todayStr + "T13:00:00Z"), createdAt: new Date() },

      // demo@example.com (1 expense, total 2,000)
      { id: 301, email: "demo@example.com", amount: 2000, description: "Lunch at Domino's", category: "Food", categorySource: "user", aiSuggested: false, date: new Date(todayStr + "T13:00:00Z"), expenseDate: new Date(todayStr + "T13:00:00Z"), createdAt: new Date() }
    ],
    orders: [],
    tokens: []
  };
}

let memoryDb = null;

function loadLocalDb() {
  if (memoryDb) return memoryDb;
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, "utf-8");
      memoryDb = JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Could not load local db file, initializing default seed.", e.message);
  }
  if (!memoryDb || !Array.isArray(memoryDb.users)) {
    memoryDb = getDefaultSeedData();
    saveLocalDb();
  }
  return memoryDb;
}

function saveLocalDb() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(memoryDb, null, 2), "utf-8");
  } catch (e) {
    // Non-fatal if filesystem is read-only
  }
}

async function ensureDatabase() {
  try {
    await connectDB();
  } catch (e) {
    // connectDB handled or logging
  }
}

function isDatabaseError(error) {
  return Boolean(
    error?.name === "MongoServerSelectionError" ||
    error?.name === "MongoNetworkError" ||
    error?.name === "MongooseServerSelectionError" ||
    error?.name === "MongoParseError" ||
    error?.code === "ENOTFOUND" ||
    error?.code === "ECONNREFUSED" ||
    error?.message?.includes("querySrv") ||
    error?.message?.includes("mongodb+srv URI cannot have port number") ||
    error?.message?.includes("MONGODB_URI") ||
    error?.message?.includes("MongoDB")
  );
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hasMongooseConnection() {
  return mongoose.connection.readyState === 1;
}

// ---------------------------------------------------------------------------
// USER OPERATIONS
// ---------------------------------------------------------------------------
async function getUser(email) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    const user = await User.findOne({ email: normEmail }).lean();
    return user
      ? {
          id: String(user._id),
          name: user.name || "User",
          password: user.password,
          email: user.email,
          isPremium: Boolean(user.isPremium),
          ispremiumuser: Boolean(user.ispremiumuser || user.isPremium)
        }
      : null;
  }

  // Local fallback
  const db = loadLocalDb();
  const user = db.users.find(u => normalizeEmail(u.email) === normEmail);
  return user
    ? {
        id: user.id || "usr_" + user.email,
        name: user.name || "User",
        password: user.password,
        email: user.email,
        isPremium: Boolean(user.isPremium),
        ispremiumuser: Boolean(user.ispremiumuser || user.isPremium)
      }
    : null;
}

async function createUser({ name, email, password, isPremium = false }) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);
  const trimmedName = String(name || "").trim() || "User";

  if (hasMongooseConnection()) {
    try {
      const user = await User.create({
        email: normEmail,
        name: trimmedName,
        password,
        isPremium
      });
      return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        isPremium: Boolean(user.isPremium),
        ispremiumuser: Boolean(user.ispremiumuser || user.isPremium)
      };
    } catch (error) {
      if (error?.code === 11000) {
        const duplicate = new Error("An account with this email already exists.");
        duplicate.statusCode = 409;
        throw duplicate;
      }
      throw error;
    }
  }

  // Local fallback
  const db = loadLocalDb();
  if (db.users.some(u => normalizeEmail(u.email) === normEmail)) {
    const duplicate = new Error("An account with this email already exists.");
    duplicate.statusCode = 409;
    throw duplicate;
  }
  const newUser = {
    id: "usr_" + Date.now(),
    name: trimmedName,
    email: normEmail,
    password,
    isPremium: Boolean(isPremium),
    ispremiumuser: Boolean(isPremium),
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);
  saveLocalDb();
  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    isPremium: newUser.isPremium,
    ispremiumuser: newUser.ispremiumuser
  };
}

async function updateUserPassword(email, hashedPassword) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    const user = await User.findOneAndUpdate(
      { email: normEmail },
      { password: hashedPassword },
      { new: true }
    );
    if (!user) {
      const error = new Error("User not found.");
      error.statusCode = 404;
      throw error;
    }
    return true;
  }

  // Local fallback
  const db = loadLocalDb();
  const user = db.users.find(u => normalizeEmail(u.email) === normEmail);
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }
  user.password = hashedPassword;
  saveLocalDb();
  return true;
}

// ---------------------------------------------------------------------------
// PREMIUM ORDER OPERATIONS
// ---------------------------------------------------------------------------
async function createPremiumOrder({ userId, email, orderId, amount = 199, paymentSessionId }) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    return Order.create({
      userId,
      email: normEmail,
      orderId,
      amount: Number(amount),
      paymentSessionId,
      status: "PENDING"
    });
  }

  const db = loadLocalDb();
  const order = {
    userId,
    email: normEmail,
    orderId,
    amount: Number(amount),
    paymentSessionId,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };
  db.orders.push(order);
  saveLocalDb();
  return order;
}

async function updatePremiumOrder(orderId, email, status) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    return Order.findOneAndUpdate(
      {
        orderId,
        email: normEmail,
        ...(status === "FAILED" ? { status: { $ne: "SUCCESSFUL" } } : {})
      },
      { status },
      { new: true }
    ).lean();
  }

  const db = loadLocalDb();
  const order = db.orders.find(o => o.orderId === orderId && normalizeEmail(o.email) === normEmail);
  if (order) {
    if (order.status !== "SUCCESSFUL" || status !== "FAILED") {
      order.status = status;
      saveLocalDb();
    }
  }
  return order;
}

async function getPremiumOrder(orderId, email) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    return Order.findOne({
      orderId: String(orderId || "").trim(),
      email: normEmail
    }).lean();
  }

  const db = loadLocalDb();
  return db.orders.find(o => o.orderId === orderId && normalizeEmail(o.email) === normEmail) || null;
}

async function markUserPremium(email) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    const user = await User.findOneAndUpdate(
      { email: normEmail },
      { isPremium: true, ispremiumuser: true },
      { new: true }
    ).lean();
    return user
      ? {
          id: String(user._id),
          name: user.name || "User",
          email: user.email,
          isPremium: true,
          ispremiumuser: true
        }
      : null;
  }

  const db = loadLocalDb();
  const user = db.users.find(u => normalizeEmail(u.email) === normEmail);
  if (user) {
    user.isPremium = true;
    user.ispremiumuser = true;
    saveLocalDb();
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      isPremium: true,
      ispremiumuser: true
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// EXPENSE OPERATIONS
// ---------------------------------------------------------------------------
async function getExpensesInRange(email, start, end) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (hasMongooseConnection()) {
    const expenses = await Expense.find({
      email: normEmail,
      $or: [
        { date: { $gte: startDate, $lt: endDate } },
        { expenseDate: { $gte: startDate, $lt: endDate } },
        { date: { $exists: false }, expenseDate: { $exists: false }, createdAt: { $gte: startDate, $lt: endDate } }
      ]
    })
      .select({ _id: 0, id: 1, amount: 1, description: 1, category: 1, categorySource: 1, aiSuggested: 1, createdAt: 1, expenseDate: 1, date: 1 })
      .sort({ expenseDate: 1, date: 1, createdAt: 1, id: 1 })
      .lean();

    return expenses.map((expense) => {
      const expDate = expense.date || expense.expenseDate || expense.createdAt;
      return {
        id: expense.id,
        amount: Number(expense.amount || 0),
        description: expense.description,
        category: expense.category,
        categorySource: expense.categorySource || "fallback",
        aiSuggested: Boolean(expense.aiSuggested),
        date: expDate,
        expenseDate: expDate,
        createdAt: expense.createdAt
      };
    });
  }

  // Local fallback
  const db = loadLocalDb();
  const userExpenses = db.expenses.filter(e => {
    if (normalizeEmail(e.email) !== normEmail) return false;
    const d = new Date(e.date || e.expenseDate || e.createdAt);
    return d >= startDate && d < endDate;
  });

  userExpenses.sort((a, b) => new Date(a.date || a.expenseDate || a.createdAt) - new Date(b.date || b.expenseDate || b.createdAt));
  return userExpenses.map(e => {
    const d = e.date || e.expenseDate || e.createdAt;
    return {
      id: e.id,
      amount: Number(e.amount || 0),
      description: e.description,
      category: e.category,
      categorySource: e.categorySource || "fallback",
      aiSuggested: Boolean(e.aiSuggested),
      date: d,
      expenseDate: d,
      createdAt: e.createdAt
    };
  });
}

async function getExpenses(email) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    const expenses = await Expense.find({ email: normEmail })
      .select({ _id: 0, id: 1, amount: 1, description: 1, category: 1, categorySource: 1, aiSuggested: 1, createdAt: 1, expenseDate: 1, date: 1 })
      .sort({ createdAt: -1 })
      .lean();

    return expenses.map((expense) => {
      const expDate = expense.date || expense.expenseDate || expense.createdAt;
      return {
        id: expense.id,
        amount: expense.amount,
        description: expense.description,
        category: expense.category,
        categorySource: expense.categorySource || "fallback",
        aiSuggested: Boolean(expense.aiSuggested),
        date: expDate,
        expenseDate: expDate,
        createdAt: expense.createdAt
      };
    });
  }

  const db = loadLocalDb();
  const userExpenses = db.expenses.filter(e => normalizeEmail(e.email) === normEmail);
  userExpenses.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));
  return userExpenses.map(e => {
    const d = e.date || e.expenseDate || e.createdAt;
    return {
      id: e.id,
      amount: e.amount,
      description: e.description,
      category: e.category,
      categorySource: e.categorySource || "fallback",
      aiSuggested: Boolean(e.aiSuggested),
      date: d,
      expenseDate: d,
      createdAt: e.createdAt
    };
  });
}

async function getExpensesPage(email, { page = 1, limit = 10 } = {}) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);

  if (hasMongooseConnection()) {
    const filter = { email: normEmail };
    const [totalExpenses, totals] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.aggregate([
        { $match: filter },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } }
      ])
    ]);
    const totalPages = Math.ceil(totalExpenses / limit);
    const currentPage = Math.min(page, Math.max(totalPages, 1));
    const expenses = await Expense.find(filter)
      .select({ _id: 0, id: 1, amount: 1, description: 1, category: 1, categorySource: 1, aiSuggested: 1, createdAt: 1, expenseDate: 1, date: 1 })
      .sort({ createdAt: -1, _id: -1 })
      .skip((currentPage - 1) * limit)
      .limit(limit)
      .lean();

    return {
      expenses: expenses.map((expense) => {
        const expDate = expense.date || expense.expenseDate || expense.createdAt;
        return {
          id: expense.id,
          amount: expense.amount,
          description: expense.description,
          category: expense.category,
          categorySource: expense.categorySource || "fallback",
          aiSuggested: Boolean(expense.aiSuggested),
          date: expDate,
          expenseDate: expDate,
          createdAt: expense.createdAt
        };
      }),
      pagination: {
        currentPage,
        pageSize: limit,
        totalExpenses,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      },
      totalAmount: Number(totals[0]?.totalAmount || 0)
    };
  }

  // Local fallback
  const db = loadLocalDb();
  const userExpenses = db.expenses.filter(e => normalizeEmail(e.email) === normEmail);
  userExpenses.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

  const totalExpenses = userExpenses.length;
  const totalAmount = userExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const totalPages = Math.max(1, Math.ceil(totalExpenses / limit));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * limit;
  const paginatedItems = userExpenses.slice(startIndex, startIndex + limit);

  return {
    expenses: paginatedItems.map(e => {
      const d = e.date || e.expenseDate || e.createdAt;
      return {
        id: e.id,
        amount: Number(e.amount),
        description: e.description,
        category: e.category,
        categorySource: e.categorySource || "fallback",
        aiSuggested: Boolean(e.aiSuggested),
        date: d,
        expenseDate: d,
        createdAt: e.createdAt
      };
    }),
    pagination: {
      currentPage,
      pageSize: limit,
      totalExpenses,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPreviousPage: currentPage > 1
    },
    totalAmount
  };
}

function makeExpenseId() {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

async function addExpense({ email, userId = null, amount, description, category, categorySource, aiSuggested = false, expenseDate, date }) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);
  const inputDate = date || expenseDate;
  const parsedDate = inputDate ? new Date(inputDate) : new Date();

  if (hasMongooseConnection()) {
    const expense = await Expense.create({
      id: makeExpenseId(),
      email: normEmail,
      userId: userId ? String(userId) : null,
      amount: Number(amount),
      date: parsedDate,
      expenseDate: parsedDate,
      description: String(description).trim(),
      category: String(category),
      categorySource: categorySource || "fallback",
      aiSuggested: Boolean(aiSuggested)
    });
    return {
      id: expense.id,
      amount: expense.amount,
      description: expense.description,
      category: expense.category,
      categorySource: expense.categorySource,
      aiSuggested: expense.aiSuggested,
      date: expense.date,
      expenseDate: expense.expenseDate,
      createdAt: expense.createdAt
    };
  }

  // Local fallback
  const db = loadLocalDb();
  const newExp = {
    id: makeExpenseId(),
    email: normEmail,
    userId: userId ? String(userId) : null,
    amount: Number(amount),
    date: parsedDate.toISOString(),
    expenseDate: parsedDate.toISOString(),
    description: String(description).trim(),
    category: String(category),
    categorySource: categorySource || "fallback",
    aiSuggested: Boolean(aiSuggested),
    createdAt: new Date().toISOString()
  };
  db.expenses.unshift(newExp);
  saveLocalDb();
  return {
    id: newExp.id,
    amount: newExp.amount,
    description: newExp.description,
    category: newExp.category,
    categorySource: newExp.categorySource,
    aiSuggested: newExp.aiSuggested,
    date: newExp.date,
    expenseDate: newExp.expenseDate,
    createdAt: newExp.createdAt
  };
}

async function deleteExpense(email, expenseId) {
  await ensureDatabase();
  const normEmail = normalizeEmail(email);
  const idStr = String(expenseId || "").trim();

  if (hasMongooseConnection()) {
    const conditions = [{ email: normEmail, id: idStr }];
    if (/^\d+$/.test(idStr)) conditions.push({ email: normEmail, id: Number(idStr) });
    if (/^[a-fA-F0-9]{24}$/.test(idStr)) conditions.push({ email: normEmail, _id: idStr });

    const result = await Expense.deleteOne({ $or: conditions });
    if (!result.deletedCount) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }
    return true;
  }

  // Local fallback
  const db = loadLocalDb();
  const initialLength = db.expenses.length;
  db.expenses = db.expenses.filter(e => !(normalizeEmail(e.email) === normEmail && String(e.id) === idStr));
  if (db.expenses.length === initialLength) {
    const error = new Error("Expense not found.");
    error.statusCode = 404;
    throw error;
  }
  saveLocalDb();
  return true;
}

// ---------------------------------------------------------------------------
// LEADERBOARD
// ---------------------------------------------------------------------------
async function getLeaderboard(currentEmail) {
  await ensureDatabase();
  const normCurrent = normalizeEmail(currentEmail);

  if (hasMongooseConnection()) {
    return User.aggregate([
      {
        $lookup: {
          from: Expense.collection.name,
          let: { userEmail: "$email" },
          pipeline: [
            { $match: { $expr: { $eq: ["$email", "$$userEmail"] } } },
            {
              $group: {
                _id: null,
                totalExpense: { $sum: "$amount" },
                expenseCount: { $sum: 1 }
              }
            }
          ],
          as: "expenseSummary"
        }
      },
      {
        $match: {
          $expr: {
            $and: [
              {
                $not: {
                  $regexMatch: {
                    input: { $toLower: { $ifNull: ["$name", ""] } },
                    regex: "(^|[^a-z])(nitin|ansh|anki|dummy|test)([^a-z]|$)"
                  }
                }
              },
              {
                $not: {
                  $regexMatch: {
                    input: { $toLower: { $ifNull: ["$email", ""] } },
                    regex: "(dummy|test|example)\\.(com|net|org)$"
                  }
                }
              },
              {
                $or: [
                  {
                    $not: {
                      $regexMatch: {
                        input: { $toLower: { $ifNull: ["$name", ""] } },
                        regex: "^prem"
                      }
                    }
                  },
                  { $eq: [{ $toLower: "$email" }, "prem9771190912@gmail.com"] }
                ]
              }
            ]
          }
        }
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          name: { $ifNull: ["$name", "User"] },
          email: 1,
          isPremium: { $cond: [{ $or: [{ $eq: ["$isPremium", true] }, { $eq: ["$ispremiumuser", true] }] }, true, false] },
          totalExpense: {
            $ifNull: [{ $arrayElemAt: ["$expenseSummary.totalExpense", 0] }, 0]
          },
          expenseCount: {
            $ifNull: [{ $arrayElemAt: ["$expenseSummary.expenseCount", 0] }, 0]
          }
        }
      },
      { $sort: { totalExpense: -1, expenseCount: -1, name: 1, id: 1 } }
    ]).then((rows) => rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      isCurrentUser: normalizeEmail(row.email) === normCurrent,
      totalExpense: Number(row.totalExpense || 0),
      expenseCount: Number(row.expenseCount || 0),
      isPremium: Boolean(row.isPremium)
    })));
  }

  // Local fallback
  const db = loadLocalDb();
  const summaryByUser = {};

  db.users.forEach(u => {
    const em = normalizeEmail(u.email);
    summaryByUser[em] = {
      id: u.id,
      name: u.name || em.split("@")[0],
      email: em,
      isPremium: Boolean(u.isPremium || u.ispremiumuser),
      totalExpense: 0,
      expenseCount: 0
    };
  });

  db.expenses.forEach(e => {
    const em = normalizeEmail(e.email);
    if (!summaryByUser[em]) {
      summaryByUser[em] = {
        id: "usr_" + em,
        name: em.split("@")[0],
        email: em,
        isPremium: false,
        totalExpense: 0,
        expenseCount: 0
      };
    }
    summaryByUser[em].totalExpense += Number(e.amount || 0);
    summaryByUser[em].expenseCount += 1;
  });

  const rows = Object.values(summaryByUser);
  // Sort by totalExpense DESC, expenseCount DESC
  rows.sort((a, b) => b.totalExpense - a.totalExpense || b.expenseCount - a.expenseCount);

  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    name: row.name,
    isCurrentUser: normalizeEmail(row.email) === normCurrent,
    totalExpense: Number(row.totalExpense || 0),
    expenseCount: Number(row.expenseCount || 0),
    isPremium: Boolean(row.isPremium)
  }));
}

// ---------------------------------------------------------------------------
// PASSWORD RESET TOKENS
// ---------------------------------------------------------------------------
async function createResetToken({ email, rawToken, expiresInMs = 900000 }) {
  await ensureDatabase();
  const record = PasswordResetToken.create({ userId: email, rawToken, expiresInMs });

  if (hasMongooseConnection()) {
    await PasswordResetToken.MongooseModel.create({
      ...record,
      createdAt: new Date(record.createdAt),
      expiresAt: new Date(record.expiresAt)
    });
    return record;
  }

  const db = loadLocalDb();
  if (!db.tokens) db.tokens = [];
  db.tokens.push(record);
  saveLocalDb();
  return record;
}

async function getResetTokenByHash(tokenHash) {
  await ensureDatabase();

  if (hasMongooseConnection()) {
    const token = await PasswordResetToken.MongooseModel.findOne({ tokenHash }).lean();
    return token
      ? {
          id: token.id,
          userId: token.userId,
          tokenHash: token.tokenHash,
          createdAt: token.createdAt,
          expiresAt: token.expiresAt,
          usedAt: token.usedAt
        }
      : null;
  }

  const db = loadLocalDb();
  return (db.tokens || []).find(t => t.tokenHash === tokenHash) || null;
}

async function markTokenUsed(idOrHash) {
  await ensureDatabase();

  if (hasMongooseConnection()) {
    await PasswordResetToken.MongooseModel.updateOne(
      { $or: [{ id: idOrHash }, { tokenHash: idOrHash }] },
      { usedAt: new Date() }
    );
    return true;
  }

  const db = loadLocalDb();
  if (db.tokens) {
    const t = db.tokens.find(tok => tok.id === idOrHash || tok.tokenHash === idOrHash);
    if (t) {
      t.usedAt = new Date().toISOString();
      saveLocalDb();
    }
  }
  return true;
}

module.exports = {
  getUser,
  createUser,
  updateUserPassword,
  createPremiumOrder,
  updatePremiumOrder,
  getPremiumOrder,
  markUserPremium,
  getExpenses,
  getExpensesPage,
  getExpensesInRange,
  addExpense,
  deleteExpense,
  getLeaderboard,
  createResetToken,
  getResetTokenByHash,
  markTokenUsed,
  connectDB,
  isDatabaseError,
  isConnected: hasMongooseConnection
};
