const cashfreeService = require("../services/cashfree.service");

const mapAccountVerifyResponse = (
  data,
  verificationId,
  requestedAadhaar,
  requestedMobile,
  requestedName
) => ({
  verificationId,
  referenceId: data.reference_id,
  aadhaarNumber: data.aadhaar_number ?? requestedAadhaar ?? null,
  mobileNumber: data.mobile_number ?? requestedMobile ?? null,
  name: requestedName ?? null,
  status: data.status,
  valid: data.status === "ACCOUNT_EXISTS",
  message:
    data.status === "ACCOUNT_EXISTS"
      ? "Aadhaar account exists in DigiLocker"
      : "Aadhaar account not found in DigiLocker",
  digilockerId: data.digilocker_id || null,
});

const wrapDigiLockerUrl = (originalUrl, environment = "sandbox") => {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;

  try {
    const parsed = new URL(originalUrl);
    const baseUrl = (process.env.ONEINFO_BASE_URL || "https://kyc.oneinfo.ai").replace(/\/+$/, "");

    const params = new URLSearchParams(parsed.search);
    if (environment === "sandbox" && !params.has("env")) {
      params.set("env", "sandbox");
    }

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    return `${baseUrl}/dgl${queryStr}`;
  } catch {
    const baseUrl = (process.env.ONEINFO_BASE_URL || "https://kyc.oneinfo.ai").replace(/\/+$/, "");
    return originalUrl.replace(/https?:\/\/[^/]+(?:\.cashfree\.com\/dgl|\/dgl)/i, `${baseUrl}/dgl`);
  }
};

const mapInitiateResponse = (data, verificationId, redirectUrl, userFlow, environment = "sandbox") => ({
  verificationId,
  referenceId: data.reference_id,
  url: wrapDigiLockerUrl(data.url, environment),
  status: data.status || "PENDING",
  userFlow: data.user_flow || userFlow,
  documentRequested: data.document_requested || ["AADHAAR"],
  redirectUrl: data.redirect_url || redirectUrl,
});

const mapDocumentResponse = (data, verificationId) => ({
  verificationId,
  referenceId: data.reference_id,
  status: data.status,
  valid: data.status === "SUCCESS",
  aadhaarNumber: data.uid || null,
  registeredName: data.name || null,
  careOf: data.care_of || null,
  dob: data.dob || null,
  gender: data.gender || null,
  yearOfBirth: data.year_of_birth || null,
  photoLink: data.photo_link || null,
  splitAddress: data.split_address || null,
  message: data.message || "Aadhaar document retrieved successfully",
});

/**
 * Pure in-memory verification - NO data stored in DB
 */
const verifyAadhaar = async (req, res) => {
  const { aadhaarNumber, mobileNumber, name } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `aadhaar-${Date.now()}`;

  try {
    const providerResponse = await cashfreeService.verifyDigiLockerAccount({
      verificationId,
      aadhaarNumber,
      mobileNumber,
      environment,
    });

    const mapped = mapAccountVerifyResponse(
      providerResponse,
      verificationId,
      aadhaarNumber,
      mobileNumber,
      name
    );

    return res.status(200).json({
      success: true,
      environment,
      data: mapped,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    return res.status(status).json({
      success: false,
      environment,
      message: "Aadhaar verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const initiateDigiLocker = async (req, res) => {
  const {
    documentRequested = ["AADHAAR"],
    redirectUrl = process.env.DIGILOCKER_REDIRECT_URL || "https://oneinfo.io/callback",
    userFlow = "signup",
  } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `aadhaar-link-${Date.now()}`;

  try {
    const providerResponse = await cashfreeService.createDigiLockerUrl({
      verificationId,
      documentRequested,
      redirectUrl,
      userFlow,
      environment,
    });

    const mapped = mapInitiateResponse(
      providerResponse,
      verificationId,
      redirectUrl,
      userFlow,
      environment
    );

    return res.status(200).json({
      success: true,
      environment,
      data: mapped,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to generate DigiLocker verification link",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const getDigiLockerStatus = async (req, res) => {
  const { verificationId } = req.params;
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await cashfreeService.getDigiLockerStatus({
      verificationId,
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      status: providerResponse.status,
      valid: providerResponse.status === "AUTHENTICATED",
      userDetails: providerResponse.user_details || null,
      documentRequested: providerResponse.document_requested || [],
      documentConsent: providerResponse.document_consent || [],
      documentConsentValidity: providerResponse.document_consent_validity || null,
    };

    return res.status(200).json({
      success: true,
      environment,
      data: mapped,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to retrieve DigiLocker verification status",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const getAadhaarDocument = async (req, res) => {
  const { verificationId } = req.params;
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await cashfreeService.getDigiLockerDocument({
      verificationId,
      documentType: "AADHAAR",
      environment,
    });

    const mapped = mapDocumentResponse(providerResponse, verificationId);

    return res.status(200).json({
      success: true,
      environment,
      data: mapped,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to retrieve verified Aadhaar document",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const handleWebhook = async (req, res) => {
  // Webhook received - we do not store customer KYC data
  return res.status(200).json({
    success: true,
    message: "Webhook event acknowledged",
  });
};

const getVerificationHistory = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Data storage is disabled. Verification history is not retained.",
    data: [],
  });
};

const getVerificationById = async (_req, res) => {
  return res.status(404).json({
    success: false,
    message: "Data storage is disabled. Verification records are not retained.",
  });
};

module.exports = {
  verifyAadhaar,
  initiateDigiLocker,
  getDigiLockerStatus,
  getAadhaarDocument,
  handleWebhook,
  getVerificationHistory,
  getVerificationById,
};
