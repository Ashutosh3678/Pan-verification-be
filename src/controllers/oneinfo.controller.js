const crypto = require("crypto");
const providerService = require("../services/cashfree.service");
const ApiClient = require("../models/ApiClient");
const analyticsService = require("../services/analytics.service");

// Helper to mask secret strings for safe display
const maskSecret = (secret) => {
  if (!secret) return "";
  if (secret.length <= 6) return "******";
  return secret.slice(0, 3) + "******" + secret.slice(-3);
};

// -------------------------------------------------------------
// VERIFICATION HANDLERS (ZERO PII STORED - METRICS LOGGED)
// -------------------------------------------------------------

/**
 * Verify PAN - Pure in-memory verification with metric tracking
 */
const verifyPan = async (req, res) => {
  const startTime = Date.now();
  const { pan, name } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `oneinfo-pan-${Date.now()}`;

  try {
    const providerResponse = await providerService.verifyPan({
      pan,
      name,
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      pan: providerResponse.pan,
      type: providerResponse.type,
      nameProvided: providerResponse.name_provided ?? name ?? null,
      registeredName: providerResponse.registered_name,
      valid: providerResponse.valid,
      message: providerResponse.message,
      nameMatchScore: providerResponse.name_match_score,
      nameMatchResult: providerResponse.name_match_result,
      panStatus: providerResponse.pan_status,
      aadhaarSeedingStatus: providerResponse.aadhaar_seeding_status,
      aadhaarSeedingStatusDesc: providerResponse.aadhaar_seeding_status_desc,
      lastUpdatedAt: providerResponse.last_updated_at,
      namePanCard: providerResponse.name_pan_card,
      fatherName: providerResponse.father_name,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "PAN",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/oneinfo/pan/verify",
      environment,
      status: "SUCCESS",
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

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

    analyticsService.recordEvent({
      client: req.client,
      service: "PAN",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/oneinfo/pan/verify",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "PAN verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Verify Aadhaar Account - Pure in-memory verification with metric tracking
 */
const verifyAadhaar = async (req, res) => {
  const startTime = Date.now();
  const { aadhaarNumber, mobileNumber, name } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `oneinfo-aadhaar-${Date.now()}`;

  try {
    const providerResponse = await providerService.verifyDigiLockerAccount({
      verificationId,
      aadhaarNumber,
      mobileNumber,
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      aadhaarNumber: providerResponse.aadhaar_number ?? aadhaarNumber ?? null,
      mobileNumber: providerResponse.mobile_number ?? mobileNumber ?? null,
      name: name ?? null,
      status: providerResponse.status,
      valid: providerResponse.status === "ACCOUNT_EXISTS",
      message:
        providerResponse.status === "ACCOUNT_EXISTS"
          ? "Aadhaar account is registered with DigiLocker"
          : "Aadhaar account not found in DigiLocker",
      digilockerId: providerResponse.digilocker_id || null,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/oneinfo/aadhaar/verify",
      environment,
      status: "SUCCESS",
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

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

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/oneinfo/aadhaar/verify",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Aadhaar verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Initiate DigiLocker Link - Tracks link generation metrics
 */
const initiateDigiLocker = async (req, res) => {
  const startTime = Date.now();
  const {
    documentRequested = ["AADHAAR"],
    redirectUrl = process.env.DIGILOCKER_REDIRECT_URL || "https://oneinfo.io/kyc-callback",
    userFlow = "signup",
  } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `oneinfo-dgl-${Date.now()}`;

  try {
    const providerResponse = await providerService.createDigiLockerUrl({
      verificationId,
      documentRequested,
      redirectUrl,
      userFlow,
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      url: providerResponse.url,
      status: providerResponse.status || "PENDING",
      userFlow: providerResponse.user_flow || userFlow,
      documentRequested: providerResponse.document_requested || documentRequested,
      redirectUrl: providerResponse.redirect_url || redirectUrl,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "LINK_GENERATED",
      endpoint: req.originalUrl || "/api/oneinfo/aadhaar/initiate",
      environment,
      status: "SUCCESS",
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

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

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "LINK_GENERATED",
      endpoint: req.originalUrl || "/api/oneinfo/aadhaar/initiate",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to generate DigiLocker verification link",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Get DigiLocker Status
 */
const getDigiLockerStatus = async (req, res) => {
  const startTime = Date.now();
  const { verificationId } = req.params;
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await providerService.getDigiLockerStatus({
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

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "STATUS_CHECK",
      endpoint: req.originalUrl || `/api/oneinfo/aadhaar/status/${verificationId}`,
      environment,
      status: "SUCCESS",
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

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

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "STATUS_CHECK",
      endpoint: req.originalUrl || `/api/oneinfo/aadhaar/status/${verificationId}`,
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to retrieve DigiLocker verification status",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Retrieve Verified Document
 */
const getAadhaarDocument = async (req, res) => {
  const startTime = Date.now();
  const { verificationId } = req.params;
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await providerService.getDigiLockerDocument({
      verificationId,
      documentType: "AADHAAR",
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      status: providerResponse.status,
      valid: providerResponse.status === "SUCCESS",
      aadhaarNumber: providerResponse.uid || null,
      registeredName: providerResponse.name || null,
      careOf: providerResponse.care_of || null,
      dob: providerResponse.dob || null,
      gender: providerResponse.gender || null,
      yearOfBirth: providerResponse.year_of_birth || null,
      photoLink: providerResponse.photo_link || null,
      splitAddress: providerResponse.split_address || null,
      message: providerResponse.message || "Aadhaar document retrieved successfully",
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "DOCUMENT_FETCH",
      endpoint: req.originalUrl || `/api/oneinfo/aadhaar/document/${verificationId}`,
      environment,
      status: "SUCCESS",
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

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

    analyticsService.recordEvent({
      client: req.client,
      service: "AADHAAR",
      action: "DOCUMENT_FETCH",
      endpoint: req.originalUrl || `/api/oneinfo/aadhaar/document/${verificationId}`,
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to retrieve verified Aadhaar document",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

// -------------------------------------------------------------
// ANALYTICS & DASHBOARD METRICS
// -------------------------------------------------------------

/**
 * Get Analytics Summary for Dashboard
 */
const getAnalyticsSummary = async (req, res) => {
  try {
    const { clientId, environment, timeframeDays } = req.query;
    const summary = await analyticsService.getSummary({
      clientId: clientId || (req.client?.isMaster ? null : req.client?.clientId),
      environment,
      timeframeDays,
    });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load analytics summary",
      error: error.message,
    });
  }
};

// -------------------------------------------------------------
// USER API CLIENT MANAGEMENT (ISSUING CLIENT_ID & SECRET)
// -------------------------------------------------------------

/**
 * Register a new User/Client to get clientId & clientSecret
 */
const createApiClient = async (req, res) => {
  const { name, allowedModes = ["sandbox", "production"] } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({
      success: false,
      message: "Client name is required",
    });
  }

  try {
    const clientId = `oi_cli_${crypto.randomBytes(8).toString("hex")}`;
    const clientSecret = `oi_sec_${crypto.randomBytes(24).toString("hex")}`;
    const apiKey = `oi_live_${crypto.randomBytes(24).toString("hex")}`;

    const newClient = await ApiClient.create({
      name: String(name).trim(),
      clientId,
      clientSecret,
      apiKey,
      allowedModes,
      isActive: true,
    });

    return res.status(201).json({
      success: true,
      message: "OneInfo API Credentials generated successfully. Keep your clientSecret safe.",
      data: {
        id: newClient._id,
        name: newClient.name,
        clientId: newClient.clientId,
        clientSecret: newClient.clientSecret,
        apiKey: newClient.apiKey,
        allowedModes: newClient.allowedModes,
        isActive: newClient.isActive,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create OneInfo API credentials",
      error: error.message,
    });
  }
};

/**
 * List API Clients (with masked secrets)
 */
const listApiClients = async (_req, res) => {
  try {
    const clients = await ApiClient.find().sort({ createdAt: -1 });

    const formatted = clients.map((c) => ({
      id: c._id,
      name: c.name,
      clientId: c.clientId,
      clientSecret: maskSecret(c.clientSecret),
      apiKey: maskSecret(c.apiKey),
      allowedModes: c.allowedModes,
      isActive: c.isActive,
      createdAt: c.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to list API clients",
      error: error.message,
    });
  }
};

module.exports = {
  verifyPan,
  verifyAadhaar,
  initiateDigiLocker,
  getDigiLockerStatus,
  getAadhaarDocument,
  getAnalyticsSummary,
  createApiClient,
  listApiClients,
};
