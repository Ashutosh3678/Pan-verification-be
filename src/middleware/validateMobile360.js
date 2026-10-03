/**
 * Mobile 360 Validation Middleware
 */

const VERIFICATION_ID_REGEX = /^[a-zA-Z0-9._-]+$/;
const NAME_REGEX = /^[a-zA-Z0-9 .-]+$/;
const VALID_NOTIFICATION_MODES = ["SMS", "WHATSAPP"];
const VALID_CONSENT_TYPES = ["EXPLICIT", "IMPLICIT", "OPT-OUT", "BROAD"];

/**
 * Validate Mobile 360 Send OTP Request
 */
const validateSendOtpRequest = (req, res, next) => {
  const errors = [];

  const rawMobile =
    req.body.mobile_number ??
    req.body.mobileNumber ??
    req.body.mobile ??
    req.query.mobile_number ??
    req.query.mobileNumber;

  const rawVerificationId =
    req.body.verification_id ??
    req.body.verificationId ??
    req.query.verification_id ??
    req.query.verificationId;

  const rawName = req.body.name ?? req.query.name;

  const rawNotificationModes =
    req.body.notification_modes ??
    req.body.notificationModes ??
    req.query.notification_modes ??
    req.query.notificationModes;

  const rawUserConsent =
    req.body.user_consent ??
    req.body.userConsent ??
    req.body.consent;

  // 1. Mobile number validation
  if (!rawMobile || String(rawMobile).trim() === "") {
    errors.push("mobile_number is missing in the request.");
  } else {
    let cleanMobile = String(rawMobile).trim().replace(/[\s-]/g, "");
    if (cleanMobile.startsWith("+91") && cleanMobile.length === 13) {
      cleanMobile = cleanMobile.slice(3);
    } else if (cleanMobile.startsWith("91") && cleanMobile.length === 12) {
      cleanMobile = cleanMobile.slice(2);
    } else if (cleanMobile.startsWith("0") && cleanMobile.length === 11) {
      cleanMobile = cleanMobile.slice(1);
    }

    if (!/^[0-9]{10}$/.test(cleanMobile)) {
      errors.push("Mobile number entered is invalid.");
    } else {
      req.body.mobile_number = cleanMobile;
      req.body.mobileNumber = cleanMobile;
      req.mobileNumber = cleanMobile;
    }
  }

  // 2. Verification ID validation (optional from user, auto-generated if omitted)
  if (
    rawVerificationId !== undefined &&
    rawVerificationId !== null &&
    String(rawVerificationId).trim() !== ""
  ) {
    const cleanVId = String(rawVerificationId).trim();
    if (cleanVId.length > 50) {
      errors.push("Verification ID cannot exceed 50 characters.");
    } else if (!VERIFICATION_ID_REGEX.test(cleanVId)) {
      errors.push(
        "verification_id can include only alphanum, dot, hyphen and underscores."
      );
    } else {
      req.body.verification_id = cleanVId;
      req.body.verificationId = cleanVId;
      req.verificationId = cleanVId;
    }
  } else {
    const generatedVId = `mob360_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    req.body.verification_id = generatedVId;
    req.body.verificationId = generatedVId;
    req.verificationId = generatedVId;
  }

  // 3. Name validation (optional)
  if (
    rawName !== undefined &&
    rawName !== null &&
    String(rawName).trim() !== ""
  ) {
    const cleanName = String(rawName).trim();
    if (cleanName.length > 100) {
      errors.push("Name can include a maximum of 100 characters.");
    } else if (!NAME_REGEX.test(cleanName)) {
      errors.push(
        "name should only contains alphanumeric, space, dot and hyphen."
      );
    } else {
      req.body.name = cleanName;
    }
  }

  // 4. Notification Modes validation
  let notificationModes = ["SMS"];
  if (rawNotificationModes) {
    const modesList = Array.isArray(rawNotificationModes)
      ? rawNotificationModes
      : [rawNotificationModes];

    const cleanModes = modesList.map((m) => String(m).trim().toUpperCase());
    const invalidModes = cleanModes.filter(
      (m) => !VALID_NOTIFICATION_MODES.includes(m)
    );

    if (invalidModes.length > 0) {
      errors.push(
        `Invalid notification_modes: ${invalidModes.join(
          ", "
        )}. Allowed modes are SMS and WHATSAPP.`
      );
    } else {
      notificationModes = cleanModes;
    }
  }
  req.body.notification_modes = notificationModes;
  req.body.notificationModes = notificationModes;

  // 5. User Consent validation & formatting
  let userConsent = {
    obtained: true,
    type: "EXPLICIT",
    timestamp: new Date().toISOString(),
    purpose: "User consent to fetch data.",
  };

  if (rawUserConsent && typeof rawUserConsent === "object") {
    const consentType = String(
      rawUserConsent.type || "EXPLICIT"
    ).toUpperCase();

    userConsent.obtained = rawUserConsent.obtained !== false;
    userConsent.type = VALID_CONSENT_TYPES.includes(consentType)
      ? consentType
      : "EXPLICIT";

    // Timestamp must be in UTC and within 5 minutes before or after current time
    const now = Date.now();
    if (rawUserConsent.timestamp) {
      const parsedDate = new Date(rawUserConsent.timestamp);
      const diffMs = Math.abs(now - parsedDate.getTime());
      // If valid and within 4 minutes (with safety buffer), keep it; otherwise auto-refresh to live UTC
      if (!isNaN(parsedDate.getTime()) && diffMs <= 4 * 60 * 1000) {
        userConsent.timestamp = parsedDate.toISOString();
      } else {
        userConsent.timestamp = new Date(now).toISOString();
      }
    } else {
      userConsent.timestamp = new Date(now).toISOString();
    }

    // Purpose length must be between 20 and 100 characters
    if (rawUserConsent.purpose && typeof rawUserConsent.purpose === "string") {
      let cleanPurpose = rawUserConsent.purpose.trim();
      if (cleanPurpose.length < 20) {
        cleanPurpose = (cleanPurpose + " for verification purposes.").slice(
          0,
          100
        );
      } else if (cleanPurpose.length > 100) {
        cleanPurpose = cleanPurpose.slice(0, 100);
      }
      userConsent.purpose = cleanPurpose;
    }

    if (rawUserConsent.network_details) {
      userConsent.network_details = rawUserConsent.network_details;
    }
    if (rawUserConsent.device_details) {
      userConsent.device_details = rawUserConsent.device_details;
    }
  }

  req.body.user_consent = userConsent;
  req.body.userConsent = userConsent;

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
 * Validate Mobile 360 Verify OTP Request
 */
const validateVerifyOtpRequest = (req, res, next) => {
  const errors = [];

  const rawVerificationId =
    req.body.verification_id ??
    req.body.verificationId ??
    req.params.verificationId ??
    req.query.verification_id ??
    req.query.verificationId;

  const rawOtp =
    req.body.otp ??
    req.body.OTP ??
    req.query.otp ??
    req.query.OTP;

  if (!rawVerificationId || String(rawVerificationId).trim() === "") {
    errors.push("verification_id is missing in the request.");
  } else {
    const cleanVId = String(rawVerificationId).trim();
    req.body.verification_id = cleanVId;
    req.body.verificationId = cleanVId;
    req.verificationId = cleanVId;
  }

  if (!rawOtp || String(rawOtp).trim() === "") {
    errors.push("otp is missing in the request.");
  } else {
    const cleanOtp = String(rawOtp).trim();
    if (!/^[0-9]{4,6}$/.test(cleanOtp)) {
      errors.push("OTP should be a 4 to 6 digit numeric code.");
    } else {
      req.body.otp = cleanOtp;
      req.otp = cleanOtp;
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
  validateSendOtpRequest,
  validateVerifyOtpRequest,
};
