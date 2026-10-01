const AADHAAR_REGEX = /^\d{12}$/;
const MOBILE_REGEX = /^[6-9]\d{9}$/;

const validateAadhaarRequest = (req, res, next) => {
  const rawAadhaar = req.body.aadhaar || req.body.aadhaarNumber;
  const rawMobile = req.body.mobileNumber || req.body.mobile;
  const name = req.body.name;
  const errors = [];

  let cleanAadhaar = null;
  let cleanMobile = null;

  if (rawAadhaar !== undefined && rawAadhaar !== null) {
    cleanAadhaar = String(rawAadhaar).replace(/[\s-]/g, "");
    if (!AADHAAR_REGEX.test(cleanAadhaar)) {
      errors.push(
        "aadhaar/aadhaarNumber must be a valid 12-digit numeric Aadhaar number"
      );
    }
  }

  if (rawMobile !== undefined && rawMobile !== null) {
    cleanMobile = String(rawMobile).replace(/[\s-]/g, "");
    if (!MOBILE_REGEX.test(cleanMobile)) {
      errors.push(
        "mobileNumber must be a valid 10-digit Indian mobile number starting with 6-9"
      );
    }
  }

  if (!cleanAadhaar && !cleanMobile) {
    errors.push(
      "Either aadhaar/aadhaarNumber or mobileNumber is required to verify DigiLocker account"
    );
  }

  if (name !== undefined && name !== null && !String(name).trim()) {
    errors.push("name cannot be empty when provided");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  if (cleanAadhaar) {
    req.body.aadhaarNumber = cleanAadhaar;
  }
  if (cleanMobile) {
    req.body.mobileNumber = cleanMobile;
  }
  if (name) {
    req.body.name = String(name).trim();
  }

  next();
};

const validateInitiateDigiLocker = (req, res, next) => {
  const { redirectUrl, userFlow, documentRequested } = req.body;
  const errors = [];

  if (redirectUrl !== undefined && redirectUrl !== null) {
    try {
      new URL(redirectUrl);
    } catch {
      errors.push("redirectUrl must be a valid absolute URL (e.g. https://example.com/callback)");
    }
  }

  if (userFlow !== undefined && userFlow !== null) {
    const normalizedFlow = String(userFlow).toLowerCase();
    if (!["signin", "signup"].includes(normalizedFlow)) {
      errors.push("userFlow must be either 'signin' or 'signup'");
    } else {
      req.body.userFlow = normalizedFlow;
    }
  }

  if (documentRequested !== undefined && documentRequested !== null) {
    if (!Array.isArray(documentRequested) || documentRequested.length === 0) {
      errors.push("documentRequested must be a non-empty array of document types (e.g. ['AADHAAR'])");
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
  validateAadhaarRequest,
  validateInitiateDigiLocker,
};
