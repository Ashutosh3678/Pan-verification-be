const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Validate document upload request.
 * Supports both multipart/form-data (req.file) and JSON base64 (req.body.document).
 * Ensures ZERO disk retention.
 */
const validateDocumentUpload = (req, res, next) => {
  const errors = [];

  // 1. If uploaded as multipart file via multer
  if (req.file && req.file.buffer) {
    if (req.file.size > 10 * 1024 * 1024) {
      errors.push("Document size exceeds the maximum limit of 10MB");
    }

    // Verify PDF magic header bytes: %PDF (0x25 0x50 0x44 0x46)
    const header = req.file.buffer.subarray(0, 4).toString("utf8");
    if (!header.startsWith("%PDF")) {
      errors.push("Invalid file format. Uploaded file is not a valid PDF document");
    }
  } else {
    // 2. Check if sent as base64 string in JSON body
    const base64Data =
      req.body.document || req.body.fileBase64 || req.body.pdfBase64;

    if (base64Data && typeof base64Data === "string") {
      try {
        const cleanBase64 = base64Data.replace(
          /^data:application\/pdf;base64,/,
          ""
        );
        const buffer = Buffer.from(cleanBase64, "base64");

        if (buffer.length > 10 * 1024 * 1024) {
          errors.push("Document size exceeds the maximum limit of 10MB");
        }

        const header = buffer.subarray(0, 4).toString("utf8");
        if (!header.startsWith("%PDF")) {
          errors.push(
            "Invalid base64 document format. Content is not a valid PDF document"
          );
        } else {
          req.file = {
            buffer,
            originalname: req.body.filename || "document.pdf",
            size: buffer.length,
            mimetype: "application/pdf",
          };
        }
      } catch (err) {
        errors.push("Failed to parse base64 document: " + err.message);
      }
    } else {
      errors.push(
        "PDF document is required. Upload file in 'document' field (multipart/form-data) or provide base64 in 'document' body property."
      );
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

/**
 * Validate E-Sign Request parameters
 */
const validateCreateEsignRequest = (req, res, next) => {
  const errors = [];

  const rawDocId = req.body.documentId ?? req.body.document_id;
  const rawVerificationId =
    req.body.verificationId ?? req.body.verification_id;
  const rawNotificationModes =
    req.body.notificationModes ?? req.body.notification_modes;
  const rawExpiryInDays = req.body.expiryInDays ?? req.body.expiry_in_days;
  const rawAuthType = req.body.authType ?? req.body.auth_type ?? "AADHAAR";
  const rawCaptureLocation =
    req.body.captureLocation ?? req.body.capture_location ?? false;
  const rawRedirectUrl = req.body.redirectUrl ?? req.body.redirect_url;
  const rawSigners = req.body.signers;

  // Document ID
  if (rawDocId === undefined || rawDocId === null || isNaN(Number(rawDocId))) {
    errors.push("documentId / document_id is required and must be a valid integer ID");
  } else {
    req.body.documentId = Number(rawDocId);
    req.body.document_id = Number(rawDocId);
  }

  // Verification ID
  if (rawVerificationId !== undefined && rawVerificationId !== null) {
    const vIdStr = String(rawVerificationId).trim();
    if (vIdStr.length > 50) {
      errors.push("verificationId cannot exceed 50 characters");
    } else if (!VERIFICATION_ID_REGEX.test(vIdStr)) {
      errors.push(
        "verificationId can only contain alphanumeric characters, period (.), hyphen (-), and underscore (_)"
      );
    } else {
      req.body.verificationId = vIdStr;
      req.body.verification_id = vIdStr;
    }
  }

  // Auth Type
  if (String(rawAuthType).toUpperCase() !== "AADHAAR") {
    errors.push("authType must be 'AADHAAR'");
  } else {
    req.body.authType = "AADHAAR";
    req.body.auth_type = "AADHAAR";
  }

  // Expiry in days
  if (rawExpiryInDays !== undefined && rawExpiryInDays !== null) {
    const days = Number(rawExpiryInDays);
    if (isNaN(days) || days < 1 || days > 15) {
      errors.push("expiryInDays must be an integer between 1 and 15 days");
    } else {
      req.body.expiryInDays = String(days);
      req.body.expiry_in_days = String(days);
    }
  } else {
    req.body.expiryInDays = "2";
    req.body.expiry_in_days = "2";
  }

  // Notification modes - defaults to [] to suppress third-party provider emails
  let notificationModes = [];
  if (rawNotificationModes !== undefined && rawNotificationModes !== null) {
    if (!Array.isArray(rawNotificationModes)) {
      errors.push("notificationModes must be an array (e.g. [])");
    } else {
      notificationModes = rawNotificationModes;
    }
  }
  req.body.notificationModes = notificationModes;
  req.body.notification_modes = notificationModes;

  // Capture location
  req.body.captureLocation = Boolean(rawCaptureLocation);
  req.body.capture_location = Boolean(rawCaptureLocation);

  // Redirect URL
  if (rawRedirectUrl !== undefined && rawRedirectUrl !== null && String(rawRedirectUrl).trim()) {
    try {
      new URL(rawRedirectUrl);
      req.body.redirectUrl = String(rawRedirectUrl).trim();
      req.body.redirect_url = String(rawRedirectUrl).trim();
    } catch {
      errors.push("redirectUrl must be a valid absolute URL (e.g. https://example.com/callback)");
    }
  }

  // Signers
  if (!Array.isArray(rawSigners) || rawSigners.length === 0) {
    errors.push("signers is required and must be a non-empty array of signer objects");
  } else {
    if (rawSigners.length > 1 && (!notificationModes || !notificationModes.includes("email"))) {
      errors.push("Multiple signers are not allowed without 'email' in notificationModes");
    }

    rawSigners.forEach((signer, idx) => {
      const signerNum = idx + 1;
      if (!signer.name || !String(signer.name).trim()) {
        errors.push(`Signer #${signerNum}: name is required`);
      }

      // Email is optional (omitted to keep flow white-labeled without provider emails)
      if (signer.email !== undefined && signer.email !== null && String(signer.email).trim() !== "") {
        if (!EMAIL_REGEX.test(String(signer.email).trim())) {
          errors.push(`Signer #${signerNum}: valid email format is required if provided`);
        }
      }

      const aadhaarLast4 =
        signer.aadhaar_last_four_digit ?? signer.aadhaarLastFourDigit;
      if (aadhaarLast4 !== undefined && aadhaarLast4 !== null) {
        if (!/^\d{4}$/.test(String(aadhaarLast4).trim())) {
          errors.push(
            `Signer #${signerNum}: aadhaar_last_four_digit must be exactly 4 numeric digits`
          );
        }
      }

      const signPositions = signer.sign_positions ?? signer.signPositions;
      if (!Array.isArray(signPositions) || signPositions.length === 0) {
        errors.push(`Signer #${signerNum}: sign_positions must be a non-empty array`);
      } else {
        signPositions.forEach((pos, pIdx) => {
          const page = Number(pos.page);
          const x1 = Number(pos.top_left_x_coordinate ?? pos.topLeftXCoordinate);
          const x2 = Number(
            pos.bottom_right_x_coordinate ?? pos.bottomRightXCoordinate
          );
          const y1 = Number(pos.top_left_y_coordinate ?? pos.topLeftYCoordinate);
          const y2 = Number(
            pos.bottom_right_y_coordinate ?? pos.bottomRightYCoordinate
          );

          if (isNaN(page) || page < 1) {
            errors.push(
              `Signer #${signerNum} position #${pIdx + 1}: page must be an integer >= 1`
            );
          }
          if (isNaN(x1) || isNaN(x2) || isNaN(y1) || isNaN(y2)) {
            errors.push(
              `Signer #${signerNum} position #${pIdx + 1}: coordinates (top_left_x, bottom_right_x, top_left_y, bottom_right_y) are required numbers`
            );
          }
        });
      }
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

/**
 * Validate E-Sign Status Query
 */
const validateGetEsignStatus = (req, res, next) => {
  const verificationId =
    req.params.verificationId ||
    req.query.verificationId ||
    req.query.verification_id;

  const referenceId = req.query.referenceId || req.query.reference_id;

  if (!verificationId && !referenceId) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: ["Please provide verificationId (path/query) or referenceId (query)"],
    });
  }

  req.verificationId = verificationId;
  req.referenceId = referenceId;
  next();
};

module.exports = {
  validateDocumentUpload,
  validateCreateEsignRequest,
  validateGetEsignStatus,
};
