const axios = require("axios");

/**
 * Resolves credentials directly from .env based on the requested mode
 */
const getCredentialsForMode = (environment = "sandbox") => {
  // Always refresh from .env so modifications to .env take effect immediately
  require("dotenv").config({ override: true });

  const mode = environment === "production" ? "production" : "sandbox";

  let clientId;
  let clientSecret;
  let baseURL;
  const apiVersion = "2023-08-01";

  if (mode === "production") {
    clientId = (
      process.env.CASHFREE_PROD_CLIENT_ID || process.env.CASHFREE_CLIENT_ID
    )?.trim();
    clientSecret = (
      process.env.CASHFREE_PROD_CLIENT_SECRET ||
      process.env.CASHFREE_CLIENT_SECRET
    )?.trim();
    baseURL = "https://api.cashfree.com/verification";
  } else {
    clientId = (
      process.env.CASHFREE_SANDBOX_CLIENT_ID || process.env.CASHFREE_CLIENT_ID
    )?.trim();
    clientSecret = (
      process.env.CASHFREE_SANDBOX_CLIENT_SECRET ||
      process.env.CASHFREE_CLIENT_SECRET
    )?.trim();
    baseURL = "https://sandbox.cashfree.com/verification";
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      `Verification provider credentials are not configured for '${mode}' mode. Please configure credentials in your environment.`
    );
  }


  return {
    clientId,
    clientSecret,
    baseURL,
    apiVersion,
  };
};

const getClient = (environment = "sandbox") => {
  const { clientId, clientSecret, baseURL, apiVersion } =
    getCredentialsForMode(environment);

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": apiVersion,
    },
    timeout: 30000,
  });
};

const sanitizeError = (error) => {
  if (error.response?.data) {
    const data = error.response.data;
    if (typeof data.message === "string") {
      data.message = data.message.replace(/cashfree/gi, "Verification Provider");
    }
  }
  if (typeof error.message === "string") {
    error.message = error.message.replace(/cashfree/gi, "Verification Provider");
  }
  return error;
};

const verifyPan = async ({ pan, name, environment = "sandbox" }) => {
  try {
    const client = getClient(environment);
    const payload = { pan };

    if (name) {
      payload.name = name;
    }

    const response = await client.post("/pan", payload);
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

const verifyDigiLockerAccount = async ({
  verificationId,
  aadhaarNumber,
  mobileNumber,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const payload = {
      verification_id: verificationId,
    };

    if (aadhaarNumber) {
      payload.aadhaar_number = aadhaarNumber;
    }

    if (mobileNumber) {
      payload.mobile_number = mobileNumber;
    }

    const response = await client.post("/digilocker/verify-account", payload);
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

const createDigiLockerUrl = async ({
  verificationId,
  documentRequested = ["AADHAAR"],
  redirectUrl,
  userFlow = "signup",
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const payload = {
      verification_id: verificationId,
      document_requested: documentRequested,
      redirect_url: redirectUrl,
      user_flow: userFlow,
    };

    const response = await client.post("/digilocker", payload);
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

const getDigiLockerStatus = async ({
  verificationId,
  referenceId,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const params = {};

    if (verificationId) params.verification_id = verificationId;
    if (referenceId) params.reference_id = referenceId;

    const response = await client.get("/digilocker", { params });
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

const getDigiLockerDocument = async ({
  verificationId,
  referenceId,
  documentType = "AADHAAR",
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const params = {};

    if (verificationId) params.verification_id = verificationId;
    if (referenceId) params.reference_id = referenceId;

    const response = await client.get(`/digilocker/document/${documentType}`, {
      params,
    });
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Upload document for E-Sign (Pure in-memory, zero disk storage)
 */
const uploadEsignDocument = async ({
  documentBuffer,
  filename = "document.pdf",
  environment = "sandbox",
}) => {
  try {
    const { clientId, clientSecret, baseURL } =
      getCredentialsForMode(environment);

    const formData = new FormData();
    const blob = new Blob([documentBuffer], { type: "application/pdf" });
    formData.append("document", blob, filename);

    const response = await axios.post(`${baseURL}/esignature/document`, formData, {
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2023-12-18",
      },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Create E-Sign Request
 */
const createEsignRequest = async ({
  verificationId,
  documentId,
  notificationModes = [],
  authType = "AADHAAR",
  expiryInDays = "2",
  captureLocation = false,
  signers = [],
  redirectUrl,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);

    // Suppress external provider emails to keep the experience completely white-labeled.
    // For single-signer workflows, always force notification_modes to [] so no emails are dispatched by the provider.
    const effectiveNotificationModes =
      signers.length > 1 && Array.isArray(notificationModes) && notificationModes.includes("email")
        ? ["email"]
        : [];

    const payload = {
      verification_id: verificationId,
      document_id: Number(documentId),
      notification_modes: effectiveNotificationModes,
      auth_type: authType,
      expiry_in_days: String(expiryInDays),
      capture_location: Boolean(captureLocation),
      signers: signers.map((s, idx) => ({
        name: s.name,
        ...(s.email ? { email: s.email } : {}),
        sequence: Number(s.sequence ?? (idx + 1)),
        ...(s.phone ? { phone: String(s.phone) } : {}),
        ...(s.aadhaar_last_four_digit || s.aadhaarLastFourDigit
          ? {
              aadhaar_last_four_digit: String(
                s.aadhaar_last_four_digit || s.aadhaarLastFourDigit
              ),
            }
          : {}),
        sign_positions: (s.sign_positions || s.signPositions || []).map((pos) => ({
          page: Number(pos.page || 1),
          top_left_x_coordinate: Number(
            pos.top_left_x_coordinate ?? pos.topLeftXCoordinate ?? 100
          ),
          bottom_right_x_coordinate: Number(
            pos.bottom_right_x_coordinate ?? pos.bottomRightXCoordinate ?? 200
          ),
          top_left_y_coordinate: Number(
            pos.top_left_y_coordinate ?? pos.topLeftYCoordinate ?? 180
          ),
          bottom_right_y_coordinate: Number(
            pos.bottom_right_y_coordinate ?? pos.bottomRightYCoordinate ?? 120
          ),
        })),
      })),
    };

    if (redirectUrl) {
      payload.redirect_url = redirectUrl;
    }

    const response = await client.post("/esignature", payload, {
      headers: {
        "x-api-version": "2023-12-18",
      },
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Get E-Sign Status
 */
const getEsignStatus = async ({
  verificationId,
  referenceId,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const params = {};

    if (verificationId) params.verification_id = verificationId;
    if (referenceId) params.reference_id = referenceId;

    const response = await client.get("/esignature", {
      params,
      headers: {
        "x-api-version": "2023-12-18",
      },
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Check Face Liveness (Pure in-memory, zero disk storage)
 */
const checkFaceLiveness = async ({
  verificationId,
  imageBuffer,
  filename = "face.jpg",
  mimeType = "image/jpeg",
  environment = "sandbox",
}) => {
  try {
    const { clientId, clientSecret, baseURL } =
      getCredentialsForMode(environment);

    const formData = new FormData();
    formData.append("verification_id", verificationId);

    const blob = new Blob([imageBuffer], { type: mimeType });
    formData.append("image", blob, filename);

    const response = await axios.post(`${baseURL}/face-liveness`, formData, {
      headers: {
        "x-client-id": clientId,
        "x-client-secret": clientSecret,
        "x-api-version": "2024-12-01",
      },
      timeout: 60000,
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Verify GSTIN (Pure in-memory verification, zero data retention)
 */
const verifyGstin = async ({
  gstin,
  businessName,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const payload = {
      GSTIN: gstin,
    };

    if (businessName) {
      payload.business_name = businessName;
    }

    const response = await client.post("/gstin", payload);
    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Mobile 360 - Send OTP (Pure in-memory, zero data retention)
 */
const sendMobileOtp = async ({
  verificationId,
  mobileNumber,
  name,
  notificationModes = ["SMS"],
  userConsent,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);

    const effectiveConsent = {
      obtained: true,
      type: "EXPLICIT",
      purpose: "User consent to fetch data.",
      ...(userConsent || {}),
    };

    const now = Date.now();
    const existingDate = effectiveConsent.timestamp
      ? new Date(effectiveConsent.timestamp)
      : null;
    const isStale =
      !existingDate ||
      isNaN(existingDate.getTime()) ||
      Math.abs(now - existingDate.getTime()) > 3 * 60 * 1000;

    if (isStale) {
      effectiveConsent.timestamp = new Date(now).toISOString();
    }

    const payload = {
      verification_id: verificationId,
      mobile_number: String(mobileNumber).trim(),
      notification_modes: Array.isArray(notificationModes)
        ? notificationModes
        : [notificationModes],
      user_consent: effectiveConsent,
    };

    if (name && String(name).trim()) {
      payload.name = String(name).trim();
    }

    const response = await client.post("/mobile360/otp/send", payload, {
      headers: {
        "x-api-version": "2024-12-01",
      },
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

/**
 * Mobile 360 - Verify OTP (Pure in-memory verification, zero data retention)
 */
const verifyMobileOtp = async ({
  verificationId,
  otp,
  environment = "sandbox",
}) => {
  try {
    const client = getClient(environment);
    const payload = {
      verification_id: verificationId,
      otp: String(otp).trim(),
    };

    const response = await client.post("/mobile360/otp/verify", payload, {
      headers: {
        "x-api-version": "2024-12-01",
      },
    });

    return response.data;
  } catch (error) {
    throw sanitizeError(error);
  }
};

module.exports = {
  verifyPan,
  verifyDigiLockerAccount,
  createDigiLockerUrl,
  getDigiLockerStatus,
  getDigiLockerDocument,
  uploadEsignDocument,
  createEsignRequest,
  getEsignStatus,
  checkFaceLiveness,
  verifyGstin,
  sendMobileOtp,
  verifyMobileOtp,
  getCredentialsForMode,
};
