const express = require("express");
const accountAggregatorController = require("../controllers/accountAggregator.controller");
const {
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} = require("../middleware/validateMobile360");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

// -------------------------------------------------------------
// ACCOUNT AGGREGATOR OTP FLOW (Zero Data Retention)
// -------------------------------------------------------------

// Send OTP
router.post(
  "/otp/send",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateSendOtpRequest,
  accountAggregatorController.sendOtp
);

// Alias: /send-otp
router.post(
  "/send-otp",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateSendOtpRequest,
  accountAggregatorController.sendOtp
);

// Verify OTP & Fetch Credit Score / User Profile
router.post(
  "/otp/verify",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateVerifyOtpRequest,
  accountAggregatorController.verifyOtp
);

// Alias: /verify-otp
router.post(
  "/verify-otp",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateVerifyOtpRequest,
  accountAggregatorController.verifyOtp
);

// History and record lookup endpoints (Zero data retention responses)
router.get(
  "/history",
  authenticateClient,
  accountAggregatorController.getVerificationHistory
);

router.get(
  "/:verificationId",
  authenticateClient,
  accountAggregatorController.getVerificationById
);

module.exports = router;
