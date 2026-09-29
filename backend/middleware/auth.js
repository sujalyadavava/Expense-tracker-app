const jwt = require("jsonwebtoken");
const db = require("../utils/db");

const JWT_SECRET = process.env.JWT_SECRET || "smart-expense-tracker-default-jwt-secret-2026";

async function resolveUser(payload) {
  // Email is the only supported legacy subject because expense records are
  // historically keyed by normalized email. Never accept a client-supplied
  // query/body email as the authenticated identity.
  const emailCandidate = payload?.email || (
    typeof payload?.userId === "string" && payload.userId.includes("@")
      ? payload.userId
      : ""
  );
  const email = String(emailCandidate || "").trim().toLowerCase();
  if (!email) return null;
  return db.getUser(email);
}

module.exports = async function auth(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(503).json({ success: false, message: "Server configuration unavailable." });
  }
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await resolveUser(payload);
    if (!user) return res.status(401).json({ success: false, message: "User not found" });
    req.user = user;
    next();
  } catch (e) {
    if (db.isDatabaseError(e)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports.optional = async function optionalAuth(req, res, next) {
  if (!JWT_SECRET) return next();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = await resolveUser(payload);
  } catch (e) {
    if (db.isDatabaseError(e)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
  }
  next();
};
