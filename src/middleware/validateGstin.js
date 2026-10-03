/**
 * GSTIN Validation Regex:
 * Format: 2 numeric state digits + 10-char PAN + 1 entity alphanumeric + 'Z' + 1 checksum alphanumeric (total 15 characters).
 */
const GSTIN_REGEX =
  /^[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}[1-9A-Za-z]{1}[Zz][0-9A-Za-z]{1}$/;
const GSTIN_BASIC_ALPHANUM_REGEX = /^[0-9]{2}[a-zA-Z0-9]{13}$/;

/**
 * Validate GSTIN verification request
 */
const validateGstinRequest = (req, res, next) => {
  const errors = [];

  const rawGstin = req.body.gstin ?? req.body.GSTIN ?? req.query.gstin ?? req.query.GSTIN;
  const rawBusinessName =
    req.body.businessName ??
    req.body.business_name ??
    req.query.businessName ??
    req.query.business_name;
  const rawVerificationId =
    req.body.verificationId ??
    req.body.verification_id ??
    req.query.verificationId ??
    req.query.verification_id;

  // 1. GSTIN validation
  if (!rawGstin || typeof rawGstin !== "string" || !rawGstin.trim()) {
    errors.push("GSTIN is missing in the request.");
  } else {
    const cleanGstin = rawGstin.trim().toUpperCase();

    if (cleanGstin.length !== 15 || !GSTIN_BASIC_ALPHANUM_REGEX.test(cleanGstin)) {
      errors.push(
        "GSTIN first 2 digits should be numeric and length should not exceed 15 and should be alphanumeric."
      );
    } else if (!GSTIN_REGEX.test(cleanGstin)) {
      errors.push(
        "Invalid GSTIN format. Expected 15 characters (2 state digits + 10-character PAN + 1 entity digit + 'Z' + 1 check digit)."
      );
    } else {
      req.body.gstin = cleanGstin;
      req.body.GSTIN = cleanGstin;
      req.gstin = cleanGstin;
    }
  }

  // 2. Business name validation (optional)
  if (
    rawBusinessName !== undefined &&
    rawBusinessName !== null &&
    String(rawBusinessName).trim() !== ""
  ) {
    const bNameStr = String(rawBusinessName).trim();
    if (bNameStr.length > 200) {
      errors.push("business_name can include a maximum of 200 characters.");
    } else {
      req.body.businessName = bNameStr;
      req.body.business_name = bNameStr;
    }
  }

  // 3. Verification ID (optional)
  if (
    rawVerificationId !== undefined &&
    rawVerificationId !== null &&
    String(rawVerificationId).trim() !== ""
  ) {
    const vIdStr = String(rawVerificationId).trim();
    req.body.verificationId = vIdStr;
    req.body.verification_id = vIdStr;
    req.verificationId = vIdStr;
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
  validateGstinRequest,
};
