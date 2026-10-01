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

module.exports = {
  verifyPan,
  verifyDigiLockerAccount,
  createDigiLockerUrl,
  getDigiLockerStatus,
  getDigiLockerDocument,
  getCredentialsForMode,
};
