const VERIFICATION_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

/**
 * Validate Face Liveness request.
 * Supports both:
 *   1. multipart/form-data with binary file in 'image' (or 'file') field
 *   2. application/json with base64 string in 'image', 'imageBase64', or 'image_base64'
 * Ensures ZERO disk retention (RAM Buffer only).
 */
const validateFaceLiveness = (req, res, next) => {
  const errors = [];

  // 1. Verification ID Validation
  const rawVerificationId =
    req.body.verification_id ?? req.body.verificationId ?? req.query.verification_id ?? req.query.verificationId;

  if (rawVerificationId !== undefined && rawVerificationId !== null && String(rawVerificationId).trim() !== "") {
    const vIdStr = String(rawVerificationId).trim();
    if (vIdStr.length > 50) {
      errors.push("verification_id cannot exceed 50 characters");
    } else if (!VERIFICATION_ID_REGEX.test(vIdStr)) {
      errors.push("verification_id can include only alphanumeric, period (.), hyphen (-), and underscore (_)");
    } else {
      req.verificationId = vIdStr;
      req.body.verification_id = vIdStr;
      req.body.verificationId = vIdStr;
    }
  } else {
    // Auto-generate unique verification ID if not provided
    const autoId = `face_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    req.verificationId = autoId;
    req.body.verification_id = autoId;
    req.body.verificationId = autoId;
  }

  // 2. Image Validation & In-Memory Extraction
  if (req.file && req.file.buffer) {
    if (req.file.size > 10 * 1024 * 1024) {
      errors.push("File size exceeded 10MB limit");
    }

    const buf = req.file.buffer;
    const isJpeg = buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng =
      buf.length >= 4 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;

    if (!isJpeg && !isPng) {
      errors.push("Invalid image format. Supported formats are JPEG, JPG, and PNG.");
    } else {
      req.file.mimetype = isPng ? "image/png" : "image/jpeg";
      if (!req.file.originalname) {
        req.file.originalname = isPng ? "face.png" : "face.jpg";
      }
    }
  } else {
    // Check if image is provided as base64 string in JSON body
    const base64Data =
      req.body.image || req.body.imageBase64 || req.body.image_base64 || req.body.fileBase64;

    if (base64Data && typeof base64Data === "string" && base64Data.trim() !== "") {
      try {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z+]+;base64,/, "");
        const buffer = Buffer.from(cleanBase64, "base64");

        if (buffer.length === 0) {
          errors.push("Invalid base64 image data");
        } else if (buffer.length > 10 * 1024 * 1024) {
          errors.push("File size exceeded 10MB limit");
        } else {
          const isJpeg =
            buffer.length >= 3 &&
            buffer[0] === 0xff &&
            buffer[1] === 0xd8 &&
            buffer[2] === 0xff;
          const isPng =
            buffer.length >= 4 &&
            buffer[0] === 0x89 &&
            buffer[1] === 0x50 &&
            buffer[2] === 0x4e &&
            buffer[3] === 0x47;

          if (!isJpeg && !isPng) {
            errors.push("Invalid image format. Supported formats are JPEG, JPG, and PNG.");
          } else {
            req.file = {
              buffer,
              originalname: isPng ? "face.png" : "face.jpg",
              size: buffer.length,
              mimetype: isPng ? "image/png" : "image/jpeg",
            };
          }
        }
      } catch (err) {
        errors.push("Failed to parse base64 image: " + err.message);
      }
    } else {
      errors.push(
        "image is missing in the request. Upload an image file in 'image' field (multipart/form-data) or provide base64 string in 'image' JSON field."
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

module.exports = {
  validateFaceLiveness,
};
