const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const esignController = require("../controllers/esign.controller");
const upload = require("../middleware/upload");
const {
  validateDocumentUpload,
  validateCreateEsignRequest,
  validateGetEsignStatus,
} = require("../middleware/validateEsign");
const { authenticateClient } = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

// Upload Document for E-Sign
router.post(
  "/document/upload",
  authenticateClient,
  checkGuardrail("ESIGN"),
  upload.single("document"),
  validateDocumentUpload,
  oneinfoController.uploadEsignDocument
);

router.post(
  "/upload",
  authenticateClient,
  checkGuardrail("ESIGN"),
  upload.single("document"),
  validateDocumentUpload,
  oneinfoController.uploadEsignDocument
);

// Create E-Sign Request
router.post(
  "/request",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateCreateEsignRequest,
  oneinfoController.createEsignRequest
);

router.post(
  "/create",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateCreateEsignRequest,
  oneinfoController.createEsignRequest
);

// Get E-Sign Status
router.get(
  "/status/:verificationId",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateGetEsignStatus,
  oneinfoController.getEsignStatus
);

router.get(
  "/status",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateGetEsignStatus,
  oneinfoController.getEsignStatus
);

// Webhook endpoint
router.post("/webhook", esignController.handleWebhook);

// History and record lookup endpoints (Zero data retention response)
router.get("/history", authenticateClient, esignController.getVerificationHistory);
router.get("/:verificationId", authenticateClient, esignController.getVerificationById);

module.exports = router;
