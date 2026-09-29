const assert = require("node:assert/strict");
const test = require("node:test");
const bcrypt = require("bcryptjs");

const database = require("../config/database");
database.connectDB = async () => true;

const PasswordResetToken = require("../models/PasswordResetToken");
const db = require("../utils/db");
const authController = require("../controllers/authController");

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

test("forgot/reset password preserves hashed, expiring, one-time reset tokens", async () => {
  const tokenModel = PasswordResetToken.MongooseModel;
  const originalCreate = tokenModel.create;
  const originalFindOne = tokenModel.findOne;
  const originalUpdateOne = tokenModel.updateOne;
  const originalGetUser = db.getUser;
  const originalUpdatePassword = db.updateUserPassword;
  const storedTokens = [];
  let updatedPassword;

  tokenModel.create = async (record) => {
    storedTokens.push({ ...record });
    return record;
  };
  tokenModel.findOne = (filter) => ({
    lean: async () => storedTokens.find((record) => record.tokenHash === filter.tokenHash) || null
  });
  tokenModel.updateOne = async (filter) => {
    const record = storedTokens.find((item) => item.id === filter.$or[0].id || item.tokenHash === filter.$or[1].tokenHash);
    if (record) record.usedAt = new Date();
    return { modifiedCount: record ? 1 : 0 };
  };
  db.getUser = async (email) => email === "new-user@example.com"
    ? { id: "user-id", email, name: "New User" }
    : null;
  db.updateUserPassword = async (email, hash) => {
    updatedPassword = { email, hash };
    return true;
  };

  try {
    const forgotResponse = createResponse();
    await authController.forgotPassword({ body: { email: " New-User@Example.com " } }, forgotResponse);
    assert.equal(forgotResponse.statusCode, 200);
    assert.ok(forgotResponse.body.resetToken);
    assert.equal(new URLSearchParams(forgotResponse.body.resetUrl.split("?")[1]).get("token"), forgotResponse.body.resetToken);

    const stored = storedTokens[0];
    assert.equal(stored.userId, "new-user@example.com");
    assert.equal(stored.tokenHash, PasswordResetToken.hashToken(forgotResponse.body.resetToken));
    assert.equal(Object.hasOwn(stored, "rawToken"), false);
    assert.equal(new Date(stored.expiresAt).getTime() - new Date(stored.createdAt).getTime(), 15 * 60 * 1000);

    const resetResponse = createResponse();
    await authController.resetPassword({
      body: { token: forgotResponse.body.resetToken, password: "newPassword123" }
    }, resetResponse);
    assert.equal(resetResponse.statusCode, 200);
    assert.equal(updatedPassword.email, "new-user@example.com");
    assert.equal(await bcrypt.compare("newPassword123", updatedPassword.hash), true);
    assert.ok(stored.usedAt);

    const reusedResponse = createResponse();
    await authController.resetPassword({
      body: { token: forgotResponse.body.resetToken, password: "anotherPassword123" }
    }, reusedResponse);
    assert.equal(reusedResponse.statusCode, 400);
    assert.equal(reusedResponse.body.message, "Invalid or expired reset token.");

    const expiredRawToken = "expired-token-for-test";
    await db.createResetToken({ email: "new-user@example.com", rawToken: expiredRawToken, expiresInMs: -1000 });
    const expiredResponse = createResponse();
    await authController.resetPassword({ body: { token: expiredRawToken, password: "anotherPassword123" } }, expiredResponse);
    assert.equal(expiredResponse.statusCode, 400);
    assert.equal(expiredResponse.body.message, "Invalid or expired reset token.");
  } finally {
    tokenModel.create = originalCreate;
    tokenModel.findOne = originalFindOne;
    tokenModel.updateOne = originalUpdateOne;
    db.getUser = originalGetUser;
    db.updateUserPassword = originalUpdatePassword;
  }
});