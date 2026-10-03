const express = require("express");
const mobile360Controller = require("../controllers/mobile360.controller");
const {
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} = require("../middleware/validateMobile360");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

// -------------------------------------------------------------
// MOBILE 360 OTP FLOW (Zero Data Retention)
// -------------------------------------------------------------

// Send OTP
router.post(
  "/otp/send",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateSendOtpRequest,
  mobile360Controller.sendOtp
);

// Alias: /send-otp
router.post(
  "/send-otp",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateSendOtpRequest,
  mobile360Controller.sendOtp
);

// Verify OTP & Fetch Credit Score / User Profile
router.post(
  "/otp/verify",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateVerifyOtpRequest,
  mobile360Controller.verifyOtp
);

// Alias: /verify-otp
router.post(
  "/verify-otp",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateVerifyOtpRequest,
  mobile360Controller.verifyOtp
);

// History and record lookup endpoints (Zero data retention responses)
router.get(
  "/history",
  authenticateClient,
  mobile360Controller.getVerificationHistory
);

router.get(
  "/:verificationId",
  authenticateClient,
  mobile360Controller.getVerificationById
);

module.exports = router;
