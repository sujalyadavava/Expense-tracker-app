const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config();

const authRoutes     = require("./routes/authRoutes");
const expenseRoutes  = require("./routes/expenseRoutes");
const aiRoutes       = require("./routes/aiRoutes");
const purchaseRoutes = require("./routes/purchaseRoutes");
const expenseController = require("./controllers/expenseController");
const authMiddleware    = require("./middleware/auth");
const database          = require("./config/database");

const app = express();

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const isProduction = String(process.env.NODE_ENV || "").toLowerCase() === "production";
const ALLOWED_ORIGINS = [
  process.env.PUBLIC_APP_URL || "https://expense-tracker-app-mu-neon.vercel.app"
].filter(Boolean);

if (!isProduction) {
  ALLOWED_ORIGINS.push(
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5173"
  );
}

if (process.env.CORS_ORIGINS) {
  process.env.CORS_ORIGINS.split(",").forEach(o => {
    const trimmed = o.trim();
    if (trimmed && !ALLOWED_ORIGINS.includes(trimmed)) ALLOWED_ORIGINS.push(trimmed);
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return callback(null, true);
    if (!isProduction) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS."));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-webhook-signature"]
}));

// ---------------------------------------------------------------------------
// Body parsers & static files
// ---------------------------------------------------------------------------
// Raw body for Cashfree webhook signature verification (must come BEFORE
// express.json() so the raw buffer is preserved on webhook routes).
app.use("/api/purchase/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const distPath = path.join(__dirname, "../dist");
const fs = require("fs");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
}
app.use(express.static(path.join(__dirname, "../frontend")));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/api/health", async (req, res) => {
  try {
    await database.connectDB();
    return res.status(200).json({
      success:     true,
      database:    "connected",
      timestamp:   new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  } catch (error) {
    console.error("health check database error:", error.message);
    return res.status(503).json({
      success:  false,
      database: "unavailable",
      message:  "Database temporarily unavailable."
    });
  }
});

// ---------------------------------------------------------------------------
// API Routes
// ---------------------------------------------------------------------------
app.use("/api/auth",     authRoutes);
app.use("/api/expenses", expenseRoutes);

// Purchase routes — auth middleware applied at mount level.
// Leaderboard — also available directly at /api/leaderboard for the original SPA.
app.get("/api/leaderboard", authMiddleware, expenseController.getLeaderboard);

// AI routes are authenticated; insights and categorization both run behind
// the same JWT boundary as expense CRUD.
app.use("/api/ai", aiRoutes);

// Legacy categorization URL — kept for older frontend bundles.
app.post(
  "/api/categorize-expense",
  authMiddleware,
  require("./controllers/aiController").categorize
);

// ---------------------------------------------------------------------------
// Cashfree webhook (raw body, no auth middleware — Cashfree signs the payload)
// ---------------------------------------------------------------------------
app.post("/api/purchase/webhook", async (req, res) => {
  try {
    const appId     = process.env.CASHFREE_APP_ID;
    const secretKey = process.env.CASHFREE_SECRET_KEY;

    if (!appId || !secretKey) {
      // No Cashfree credentials configured — ignore webhook.
      return res.status(200).json({ received: true });
    }

    const { Cashfree, CFEnvironment } = require("cashfree-pg");
    const envStr = String(process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
    const cfEnv  = envStr === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
    const cashfree = new Cashfree(cfEnv, appId, secretKey);

    // req.body is a raw Buffer here (see raw body parser above).
    const rawBody  = req.body;
    const signature = req.headers["x-webhook-signature"] || "";
    const timestamp = req.headers["x-webhook-timestamp"] || "";

    let isValid = false;
    try {
      isValid = cashfree.PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (verifyErr) {
      console.error("Webhook signature verification failed:", verifyErr.message);
    }

    if (!isValid) {
      console.warn("Invalid Cashfree webhook signature — ignoring.");
      return res.status(400).json({ success: false, message: "Invalid signature." });
    }

    const event = JSON.parse(rawBody.toString("utf8"));
    const eventType  = event?.type || "";
    const orderData  = event?.data?.order || event?.data || {};
    const orderId    = orderData.order_id;
    const orderStatus = String(orderData.order_status || "").toUpperCase();

    if (eventType === "PAYMENT_SUCCESS_WEBHOOK" || orderStatus === "PAID") {
      if (orderId) {
        // Find the order in DB to get the user's email.
        const db = require("./utils/db");
        const Order = require("./models/Order");
        await db.connectDB();
        const dbOrder = await Order.findOne({ orderId }).lean();
        if (dbOrder && dbOrder.email) {
          await db.updatePremiumOrder(orderId, dbOrder.email, "SUCCESSFUL");
          await db.markUserPremium(dbOrder.email);
          console.log(`Webhook: marked ${dbOrder.email} as premium via order ${orderId}`);
        }
      }
    } else if (eventType === "PAYMENT_FAILED_WEBHOOK" || orderStatus === "EXPIRED" || orderStatus === "CANCELLED") {
      if (orderId) {
        const db = require("./utils/db");
        const Order = require("./models/Order");
        await db.connectDB();
        const dbOrder = await Order.findOne({ orderId }).lean();
        if (dbOrder && dbOrder.email) {
          await db.updatePremiumOrder(orderId, dbOrder.email, "FAILED");
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook processing error:", err.message);
    // Always return 200 to Cashfree so it doesn't keep retrying on our bug.
    return res.status(200).json({ received: true });
  }
});

// Purchase routes are mounted after the unauthenticated webhook. This order
// matters: Cashfree cannot send our user's JWT when it calls the webhook.
app.use("/api/purchase", authMiddleware, purchaseRoutes);
// Legacy mount without /api prefix (kept for backward compatibility).
app.use("/purchase", authMiddleware, purchaseRoutes);

// ---------------------------------------------------------------------------
// SPA fallback — serve React app for all other non-API GET requests
// ---------------------------------------------------------------------------
app.get("*", (req, res, next) => {
  const url = String(req.url || "");
  if (url.startsWith("/api") || url.startsWith("/purchase")) return next();
  const distIndex = path.join(__dirname, "../dist/index.html");
  if (fs.existsSync(distIndex)) {
    return res.sendFile(distIndex);
  }
  return res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ---------------------------------------------------------------------------
// Global error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.message);
  return res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal server error."
  });
});

const PORT = process.env.PORT || 3001;
module.exports = app;
