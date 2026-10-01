const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const aadhaarController = require("../controllers/aadhaar.controller");
const {
  validateAadhaarRequest,
  validateInitiateDigiLocker,
} = require("../middleware/validateAadhaar");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

router.post(
  "/verify",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  validateAadhaarRequest,
  oneinfoController.verifyAadhaar
);
router.post(
  "/initiate",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  validateInitiateDigiLocker,
  oneinfoController.initiateDigiLocker
);
router.post(
  "/create-url",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  validateInitiateDigiLocker,
  oneinfoController.initiateDigiLocker
);
router.get(
  "/status/:verificationId",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  oneinfoController.getDigiLockerStatus
);
router.get(
  "/document/:verificationId",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  oneinfoController.getAadhaarDocument
);
router.post("/webhook", aadhaarController.handleWebhook);
router.get("/history", authenticateClient, aadhaarController.getVerificationHistory);
router.get("/:verificationId", authenticateClient, aadhaarController.getVerificationById);

module.exports = router;
