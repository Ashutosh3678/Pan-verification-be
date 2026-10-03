const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const { validatePanRequest } = require("../middleware/validatePan");
const {
  validateAadhaarRequest,
  validateInitiateDigiLocker,
} = require("../middleware/validateAadhaar");
const {
  validateDocumentUpload,
  validateCreateEsignRequest,
  validateGetEsignStatus,
} = require("../middleware/validateEsign");
const { validateFaceLiveness } = require("../middleware/validateFace");
const { validateGstinRequest } = require("../middleware/validateGstin");
const {
  validateSendOtpRequest,
  validateVerifyOtpRequest,
} = require("../middleware/validateMobile360");
const upload = require("../middleware/upload");
const {
  authenticateClient,
  authenticateAdmin,
} = require("../middleware/authenticateClient");
const { checkGuardrail } = require("../middleware/guardrails.middleware");

const router = express.Router();

/**
 * Handle multipart upload gracefully for both 'image' and 'file' field names.
 */
const handleImageUpload = (req, res, next) => {
  upload.image.fields([
    { name: "image", maxCount: 1 },
    { name: "file", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: "File upload error",
        errors: [err.message],
      });
    }
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        req.file = req.files.image[0];
      } else if (req.files.file && req.files.file[0]) {
        req.file = req.files.file[0];
      }
    }
    next();
  });
};

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

// White-labeled DigiLocker Redirect Gateway
router.get("/dgl", oneinfoController.handleDigilockerRedirect);
router.get("/digilocker", oneinfoController.handleDigilockerRedirect);
router.get("/aadhaar/consent", oneinfoController.handleDigilockerRedirect);

// -------------------------------------------------------------
// E-SIGN VERIFICATION ENDPOINTS (Protected - Zero Data Stored)
// -------------------------------------------------------------

// Upload Document for E-Sign (Supports multipart file or base64 PDF in body)
router.post(
  "/esign/document/upload",
  authenticateClient,
  checkGuardrail("ESIGN"),
  upload.single("document"),
  validateDocumentUpload,
  oneinfoController.uploadEsignDocument
);

// Create E-Sign Request
router.post(
  "/esign/request",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateCreateEsignRequest,
  oneinfoController.createEsignRequest
);

// Alias: /esign/create
router.post(
  "/esign/create",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateCreateEsignRequest,
  oneinfoController.createEsignRequest
);

// Get E-Sign Status (via path parameter)
router.get(
  "/esign/status/:verificationId",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateGetEsignStatus,
  oneinfoController.getEsignStatus
);

// Get E-Sign Status (via query parameters: ?verificationId=... or ?referenceId=...)
router.get(
  "/esign/status",
  authenticateClient,
  checkGuardrail("ESIGN"),
  validateGetEsignStatus,
  oneinfoController.getEsignStatus
);

// White-labeled E-Sign Redirect Gateway
router.get("/esign/sign", oneinfoController.handleEsignRedirect);

// White-labeled Signed Document Download
router.get(
  "/esign/download/:verificationId",
  authenticateClient,
  checkGuardrail("ESIGN"),
  oneinfoController.downloadSignedDocument
);

// -------------------------------------------------------------
// FACE LIVENESS VERIFICATION ENDPOINTS (Zero Data Stored)
// -------------------------------------------------------------

// Face Liveness Check (Supports multipart file or base64 image in JSON)
router.post(
  "/face/liveness",
  authenticateClient,
  checkGuardrail("FACE"),
  handleImageUpload,
  validateFaceLiveness,
  oneinfoController.checkFaceLiveness
);

// Alias: /face/check
router.post(
  "/face/check",
  authenticateClient,
  checkGuardrail("FACE"),
  handleImageUpload,
  validateFaceLiveness,
  oneinfoController.checkFaceLiveness
);

// -------------------------------------------------------------
// GSTIN VERIFICATION ENDPOINTS (Zero Data Stored)
// -------------------------------------------------------------

// Verify GSTIN
router.post(
  "/gstin/verify",
  authenticateClient,
  checkGuardrail("GSTIN"),
  validateGstinRequest,
  oneinfoController.verifyGstin
);

// Alias: /gstin
router.post(
  "/gstin",
  authenticateClient,
  checkGuardrail("GSTIN"),
  validateGstinRequest,
  oneinfoController.verifyGstin
);

// -------------------------------------------------------------
// MOBILE 360 OTP FLOW ENDPOINTS (Zero Data Stored)
// -------------------------------------------------------------

// Send OTP
router.post(
  "/mobile360/otp/send",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateSendOtpRequest,
  oneinfoController.sendMobileOtp
);

// Verify OTP & Fetch Credit Score / User Profile
router.post(
  "/mobile360/otp/verify",
  authenticateClient,
  checkGuardrail("MOBILE360"),
  validateVerifyOtpRequest,
  oneinfoController.verifyMobileOtp
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
// CLIENT REGISTRATION & CREDENTIAL ISSUANCE
// -------------------------------------------------------------

router.post("/clients/register", oneinfoController.createApiClient);
router.post("/register", oneinfoController.createApiClient);
router.post("/admin/clients", authenticateAdmin, oneinfoController.createApiClient);
router.get("/admin/clients", authenticateAdmin, oneinfoController.listApiClients);

module.exports = router;
