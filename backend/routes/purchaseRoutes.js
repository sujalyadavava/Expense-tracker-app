const router = require("express").Router();
const controller = require("../controllers/purchaseController");

router.post("/premium", controller.createPremiumOrder);
router.post("/update-status", controller.updatePremiumStatus);
router.get("/status/:orderId", controller.getPremiumStatus);
router.get("/payment-status/:orderId", controller.getPremiumStatus);

module.exports = router;