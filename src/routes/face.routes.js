const express = require("express");
const oneinfoController = require("../controllers/oneinfo.controller");
const faceController = require("../controllers/face.controller");
const upload = require("../middleware/upload");
const { validateFaceLiveness } = require("../middleware/validateFace");
const { authenticateClient } = require("../middleware/authenticateClient");
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

// Check Face Liveness
router.post(
  "/liveness",
  authenticateClient,
  checkGuardrail("FACE"),
  handleImageUpload,
  validateFaceLiveness,
  oneinfoController.checkFaceLiveness
);

// Alias: /check
router.post(
  "/check",
  authenticateClient,
  checkGuardrail("FACE"),
  handleImageUpload,
  validateFaceLiveness,
  oneinfoController.checkFaceLiveness
);

// History and record lookup endpoints (Zero data retention response)
router.get("/history", authenticateClient, faceController.getVerificationHistory);
router.get("/:verificationId", authenticateClient, faceController.getVerificationById);

module.exports = router;
