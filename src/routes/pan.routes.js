const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const panController = require("../controllers/pan.controller");
const { validatePanRequest } = require("../middleware/validatePan");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

router.post(
  "/verify",
  authenticateClient,
  checkGuardrail("PAN"),
  validatePanRequest,
  oneinfoController.verifyPan
);
router.get("/history", authenticateClient, panController.getVerificationHistory);
router.get("/:verificationId", authenticateClient, panController.getVerificationById);

module.exports = router;

