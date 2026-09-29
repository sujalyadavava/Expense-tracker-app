import { createRequire } from "module";
const require = createRequire(import.meta.url);

const app = require("../backend/app.js");
const { connectDB } = require("../backend/config/database.js");

export default async function handler(req, res) {
  try {
    const pathname = String(req.url || "").split("?")[0];
    if (pathname.startsWith("/api/") || pathname.startsWith("/purchase")) {
      await connectDB();
    }
    return app(req, res);
  } catch (error) {
    console.error("Vercel Function Error:", error.message);
    return res.status(503).json({ success: false, message: "Database unavailable. Please try again shortly." });
  }
}
