const express = require("express");
const panController = require("../controllers/pan.controller");
const { validatePanRequest } = require("../middleware/validatePan");

const router = express.Router();

router.post("/verify", validatePanRequest, panController.verifyPan);
router.get("/history", panController.getVerificationHistory);
router.get("/:verificationId", panController.getVerificationById);

module.exports = router;
