const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../utils/db");
const PasswordResetToken = require("../models/PasswordResetToken");

const JWT_SECRET = process.env.JWT_SECRET || "smart-expense-tracker-default-jwt-secret-2026";

function generateToken(user) {
  if (!JWT_SECRET) throw new Error("JWT_SECRET environment variable is required.");
  return jwt.sign(
    {
      id: user.id || user._id || user.email,
      email: user.email,
      name: user.name || "User",
      ispremiumuser: Boolean(user.ispremiumuser || user.isPremium),
      isPremium: Boolean(user.isPremium || user.ispremiumuser)
    },
    JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email || ""));
}

async function verifyPassword(inputPassword, storedHash) {
  if (!storedHash) return false;
  const str = String(inputPassword || "");
  if (storedHash.startsWith("$2b$") || storedHash.startsWith("$2a$")) {
    return await bcrypt.compare(str, storedHash);
  }
  // Legacy fallback: crypto.scryptSync
  const legacyHash = crypto.scryptSync(str, "expense-tracker-salt", 64).toString("hex");
  return legacyHash === storedHash;
}

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const trimmedName = String(name || "").trim() || "User";

    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const hashedPassword = await bcrypt.hash(String(password), 10);
    const user = await db.createUser({ name: trimmedName, email: normalizedEmail, password: hashedPassword });
    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      user: { id: user.id, name: user.name, email: user.email, isPremium: false, ispremiumuser: false },
      token
    });
  } catch (error) {
    console.error("signup/register error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Could not create account."
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return res.status(400).json({ success: false, message: "Email and password are required." });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, message: "Please provide a valid email address." });
    }

    const user = await db.getUser(normalizedEmail);
    if (!user) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const passwordMatch = await verifyPassword(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Invalid email or password." });
    }

    const token = generateToken(user);
    return res.status(200).json({
      success: true,
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isPremium: !!user.isPremium,
        ispremiumuser: !!(user.ispremiumuser || user.isPremium)
      },
      token
    });
  } catch (error) {
    console.error("login error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again."
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required." });
    }

    const user = await db.getUser(email);
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If an account exists for this email, a reset link has been sent."
      });
    }

    const rawToken = crypto.randomUUID();
    await db.createResetToken({ email, rawToken, expiresInMs: 15 * 60 * 1000 });

    const resetUrl = `/reset-password.html?token=${encodeURIComponent(rawToken)}`;
    return res.status(200).json({
      success: true,
      message: "Password reset link created successfully.",
      resetToken: rawToken,
      resetUrl
    });
  } catch (error) {
    console.error("forgotPassword error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const token = String(req.body.token || "").trim();
    const password = String(req.body.password || "").trim();
    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Reset token and password are required." });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long." });
    }

    const tokenHash = PasswordResetToken.hashToken(token);
    const tokenRecord = await db.getResetTokenByHash(tokenHash);

    if (!tokenRecord || !PasswordResetToken.isValid(tokenRecord)) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.updateUserPassword(tokenRecord.userId, hashedPassword);
    await db.markTokenUsed(tokenRecord.id || tokenRecord.tokenHash);

    return res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    if (db.isDatabaseError(error)) {
      return res.status(503).json({ success: false, message: "Database temporarily unavailable." });
    }
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }
    return res.json({
      success: true,
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        isPremium: Boolean(req.user.isPremium || req.user.ispremiumuser),
        ispremiumuser: Boolean(req.user.ispremiumuser || req.user.isPremium)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
