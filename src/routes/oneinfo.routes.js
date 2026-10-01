const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const { validatePanRequest } = require("../middleware/validatePan");
const {
  validateAadhaarRequest,
  validateInitiateDigiLocker,
} = require("../middleware/validateAadhaar");
const {
  authenticateClient,
  authenticateAdmin,
} = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

// -------------------------------------------------------------
// VERIFICATION ENDPOINTS (Protected by Client Auth - No DB Save)
// -------------------------------------------------------------

// PAN Verification
router.post(
  "/pan/verify",
  authenticateClient,
  checkGuardrail("PAN"),
  validatePanRequest,
  oneinfoController.verifyPan
);

// Aadhaar Account Verification (Direct check)
router.post(
  "/aadhaar/verify",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  validateAadhaarRequest,
  oneinfoController.verifyAadhaar
);

// Aadhaar DigiLocker Link Initiation
router.post(
  "/aadhaar/initiate",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  validateInitiateDigiLocker,
  oneinfoController.initiateDigiLocker
);

// Aadhaar DigiLocker Live Status Check
router.get(
  "/aadhaar/status/:verificationId",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  oneinfoController.getDigiLockerStatus
);

// Aadhaar DigiLocker Document Fetch
router.get(
  "/aadhaar/document/:verificationId",
  authenticateClient,
  checkGuardrail("AADHAAR"),
  oneinfoController.getAadhaarDocument
);

// -------------------------------------------------------------
// ANALYTICS & METRICS DASHBOARD
// -------------------------------------------------------------

router.get(
  "/analytics/summary",
  authenticateClient,
  oneinfoController.getAnalyticsSummary
);

// -------------------------------------------------------------
// CLIENT CREDENTIAL ISSUANCE (Admin / Client Generation)
// -------------------------------------------------------------

router.get("/admin/clients", authenticateAdmin, oneinfoController.listApiClients);
router.post("/admin/clients", authenticateAdmin, oneinfoController.createApiClient);

module.exports = router;
