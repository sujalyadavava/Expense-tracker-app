const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../utils/db");

const JWT_SECRET = process.env.JWT_SECRET;
const PREMIUM_AMOUNT = 199;

// ---------------------------------------------------------------------------
// Cashfree SDK setup
// ---------------------------------------------------------------------------
// Lazy-initialise the Cashfree client so that the module can still be loaded
// even if the env vars are not set (e.g. during tests or in a stripped env).
let _cashfree = null;
function getCashfreeClient() {
  if (_cashfree) return _cashfree;

  const appId     = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;

  if (!appId || !secretKey) {
    // Missing credentials are only usable with the explicit local simulation
    // flag checked below. Production never gets a free-purchase fallback.
    return null;
  }

  const { Cashfree, CFEnvironment } = require("cashfree-pg");
  const envStr = String(process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase();
  const cfEnv  = envStr === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

  _cashfree = new Cashfree(cfEnv, appId, secretKey);
  return _cashfree;
}

function simulationEnabled() {
  return String(process.env.CASHFREE_SIMULATION || "").toLowerCase() === "true"
    && String(process.env.NODE_ENV || "").toLowerCase() !== "production";
}

function getReturnUrl(req) {
  const configured = String(process.env.CASHFREE_RETURN_URL || "").trim();
  const publicUrl = String(process.env.PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  const fallback = publicUrl
    ? `${publicUrl}/expenses.html`
    : `${req.protocol}://${req.get("host")}/expenses.html`;
  const returnUrl = configured || fallback;

  if (
    String(process.env.NODE_ENV || "").toLowerCase() === "production"
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(returnUrl)
  ) {
    throw new Error("CASHFREE_RETURN_URL must not use localhost in production.");
  }
  return returnUrl;
}

async function fetchGatewayStatus(cashfree, orderId) {
  const response = await cashfree.PGFetchOrder(orderId);
  const data = response?.data || response;
  return {
    raw: data,
    status: String(data?.order_status || "").toUpperCase(),
    successful: String(data?.order_status || "").toUpperCase() === "PAID"
  };
}

async function activatePaidOrder(orderId, email) {
  const user = await db.markUserPremium(email);
  if (!user) return null;
  await db.updatePremiumOrder(orderId, email, "SUCCESSFUL");
  return user;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function generateOrderId() {
  return `order_${Date.now()}_${crypto.randomBytes(5).toString("hex")}`;
}

function generateToken(user) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required.");
  return jwt.sign({
    id:            user.id,
    email:         user.email,
    name:          user.name || "User",
    isPremium:     true,
    ispremiumuser: true
  }, JWT_SECRET, { expiresIn: "30d" });
}

// Derive a stable customer_id from the user's email (Cashfree requires an
// alphanumeric string, no special chars other than - and _).
function toCashfreeCustomerId(email) {
  return `cust_${crypto.createHash("md5").update(email).digest("hex").slice(0, 20)}`;
}

// ---------------------------------------------------------------------------
// POST /api/purchase/premium
// ---------------------------------------------------------------------------
exports.createPremiumOrder = async (req, res) => {
  try {
    if (req.user.isPremium || req.user.ispremiumuser) {
      return res.status(400).json({ success: false, message: "This account is already Premium." });
    }

    const orderId = generateOrderId();
    const cashfree = getCashfreeClient();
    let paymentSessionId;
    let mode;

    if (cashfree) {
      // ---------------------------------------------------------------
      // Real Cashfree order
      // ---------------------------------------------------------------
      const returnUrl = getReturnUrl(req);

      const createOrderRequest = {
        order_id:       orderId,
        order_amount:   PREMIUM_AMOUNT,
        order_currency: "INR",
        customer_details: {
          customer_id:    toCashfreeCustomerId(req.user.email),
          customer_email: req.user.email,
          customer_phone: req.user.phone || "9999999999"   // phone is required by Cashfree
        },
        order_meta: {
          return_url: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}order_id={order_id}`
        },
        order_note: "Expense Tracker Premium Membership"
      };

      const response = await cashfree.PGCreateOrder(createOrderRequest);
      const data = response?.data || response;

      if (!data || !data.payment_session_id) {
        console.error("Cashfree PGCreateOrder unexpected response:", JSON.stringify(data));
        return res.status(502).json({
          success: false,
          message: "Payment gateway did not return a session. Please try again."
        });
      }

      paymentSessionId = data.payment_session_id;
      mode = "cashfree";
    } else if (simulationEnabled()) {
      // ---------------------------------------------------------------
      // Fallback: sandbox simulation (no Cashfree credentials set)
      // ---------------------------------------------------------------
      paymentSessionId = `sandbox_session_${crypto.randomBytes(12).toString("hex")}`;
      mode = "sandbox_simulation";
    } else {
      return res.status(503).json({
        success: false,
        message: "Cashfree payments are not configured. Please try again later."
      });
    }

    // Persist pending order in DB (works for both real and simulated).
    await db.createPremiumOrder({
      userId:           req.user.id,
      email:            req.user.email,
      orderId,
      amount:           PREMIUM_AMOUNT,
      paymentSessionId
    });

    return res.status(201).json({
      success:            true,
      payment_session_id: paymentSessionId,
      order_id:           orderId,
      amount:             PREMIUM_AMOUNT,
      mode,
      // Let the frontend know which Cashfree JS env to load.
      cashfree_env: String(process.env.CASHFREE_ENV || "sandbox").trim().toLowerCase()
    });
  } catch (error) {
    console.error("create premium order error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    // Surface Cashfree API errors clearly.
    const cfMsg = error?.response?.data?.message || error?.response?.data?.error;
    if (cfMsg) {
      return res.status(502).json({ success: false, message: `Payment gateway error: ${cfMsg}` });
    }
    return res.status(500).json({ success: false, message: "Could not create premium order." });
  }
};

// ---------------------------------------------------------------------------
// POST /api/purchase/update-status
// ---------------------------------------------------------------------------
// Called by the frontend after the Cashfree checkout completes (or fails).
// For real Cashfree orders the frontend sends the order_id; we re-verify the
// actual payment status directly from Cashfree rather than trusting the
// frontend-supplied status string.
exports.updatePremiumStatus = async (req, res) => {
  try {
    const orderId        = String(req.body.orderId || "").trim();
    const clientStatus   = String(req.body.status  || "").trim().toUpperCase();
    const isSandboxSim   = simulationEnabled() && req.body.testSuccess === true;

    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const cashfree = getCashfreeClient();

    const existingOrder = await db.getPremiumOrder(orderId, req.user.email);
    if (!existingOrder) {
      return res.status(404).json({ success: false, message: "Premium order not found." });
    }
    let successful = existingOrder.status === "SUCCESSFUL";

    if (cashfree) {
      // ---------------------------------------------------------------
      // Verify with Cashfree API — never trust the frontend status.
      // ---------------------------------------------------------------
      try {
        successful = successful || (await fetchGatewayStatus(cashfree, orderId)).successful;
      } catch (fetchErr) {
        console.error("PGFetchOrder error:", fetchErr.message);
        // If Cashfree is unreachable, mark as FAILED to be safe.
        successful = existingOrder.status === "SUCCESSFUL";
      }
    } else {
      // ---------------------------------------------------------------
      // Sandbox-simulation fallback: honour the testSuccess flag.
      // ---------------------------------------------------------------
      successful = successful || (
        isSandboxSim && (clientStatus === "SUCCESSFUL" || clientStatus === "SUCCESS")
      );
    }

    const finalStatus = successful ? "SUCCESSFUL" : "FAILED";

    const order = await db.updatePremiumOrder(orderId, req.user.email, finalStatus);
    if (!order) {
      if (successful && existingOrder.status === "SUCCESSFUL") {
        const user = await activatePaidOrder(orderId, req.user.email);
        return res.json({
          success: true,
          status: "SUCCESSFUL",
          token: user ? generateToken(user) : undefined,
          user: user || undefined
        });
      }
      return res.status(404).json({ success: false, message: "Premium order not found." });
    }

    if (!successful) {
      return res.status(200).json({ success: false, status: "FAILED", message: "Payment was not successful." });
    }

    // Mark the user as premium in the DB and issue a fresh JWT so that
    // the frontend does not have to re-login.
    const user = await activatePaidOrder(orderId, req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    return res.json({
      success: true,
      status:  "SUCCESSFUL",
      token:   generateToken(user),
      user
    });
  } catch (error) {
    console.error("update premium status error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Could not update payment status." });
  }
};

// ---------------------------------------------------------------------------
// GET /api/purchase/status/:orderId
// ---------------------------------------------------------------------------
// The return URL can land on the dashboard without the checkout modal's
// callback. This endpoint re-checks Cashfree (or reads the explicitly enabled
// local simulation state) and activates only the authenticated owner's order.
exports.getPremiumStatus = async (req, res) => {
  try {
    const orderId = String(req.params.orderId || "").trim();
    if (!orderId) {
      return res.status(400).json({ success: false, message: "orderId is required." });
    }

    const order = await db.getPremiumOrder(orderId, req.user.email);
    if (!order) {
      return res.status(404).json({ success: false, message: "Premium order not found." });
    }

    const cashfree = getCashfreeClient();
    let gatewayStatus = order.status;
    let successful = order.status === "SUCCESSFUL";

    if (cashfree) {
      try {
        const gateway = await fetchGatewayStatus(cashfree, orderId);
        gatewayStatus = gateway.status || "PENDING";
        successful = successful || gateway.successful;
      } catch (error) {
        console.error("Cashfree status lookup error:", error.message);
        gatewayStatus = "UNAVAILABLE";
      }
    }

    if (successful) {
      const user = await activatePaidOrder(orderId, req.user.email);
      return res.json({
        success: true,
        status: "SUCCESSFUL",
        orderId,
        amount: order.amount,
        gatewayStatus,
        ...(user ? { token: generateToken(user), user } : {})
      });
    }

    if (
      cashfree
      && ["EXPIRED", "CANCELLED", "FAILED"].includes(gatewayStatus)
      && order.status !== "SUCCESSFUL"
    ) {
      await db.updatePremiumOrder(orderId, req.user.email, "FAILED");
    }

    return res.json({
      success: false,
      status: order.status,
      orderId,
      amount: order.amount,
      gatewayStatus
    });
  } catch (error) {
    console.error("get premium status error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Could not check payment status." });
  }
};
