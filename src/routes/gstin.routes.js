const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const gstinController = require("../controllers/gstin.controller");
const { validateGstinRequest } = require("../middleware/validateGstin");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

// Verify GSTIN
router.post(
  "/verify",
  authenticateClient,
  checkGuardrail("GSTIN"),
  validateGstinRequest,
  oneinfoController.verifyGstin
);

// Alias: POST /api/gstin
router.post(
  "/",
  authenticateClient,
  checkGuardrail("GSTIN"),
  validateGstinRequest,
  oneinfoController.verifyGstin
);

// History and record lookup endpoints (Zero data retention response)
router.get("/history", authenticateClient, gstinController.getVerificationHistory);
router.get("/:gstin", authenticateClient, gstinController.getVerificationById);

module.exports = router;
