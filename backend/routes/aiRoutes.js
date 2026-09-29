const router = require("express").Router();
const controller = require("../controllers/aiController");
const authMiddleware = require("../middleware/auth");

// Categorization is tied to the logged-in app session. It does not expose
// expense data, but keeping it protected prevents anonymous API abuse.
router.post("/categorize", authMiddleware, controller.categorize);

// Insight — auth required (returns insight for the logged-in user's expenses).
router.get("/insight", authMiddleware, controller.insight);

module.exports = router;
