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
      endpoint: req.originalUrl || "/api/pan/verify",
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
      endpoint: req.originalUrl || "/api/pan/verify",
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
      endpoint: req.originalUrl || "/api/aadhaar/verify",
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
      endpoint: req.originalUrl || "/api/aadhaar/verify",
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
      endpoint: req.originalUrl || "/api/aadhaar/initiate",
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
      endpoint: req.originalUrl || "/api/aadhaar/initiate",
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
      endpoint: req.originalUrl || `/api/aadhaar/status/${verificationId}`,
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
      endpoint: req.originalUrl || `/api/aadhaar/status/${verificationId}`,
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
      endpoint: req.originalUrl || `/api/aadhaar/document/${verificationId}`,
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
      endpoint: req.originalUrl || `/api/aadhaar/document/${verificationId}`,
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

    const newClient = await ApiClient.create({
      name: String(name).trim(),
      clientId,
      clientSecret,
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

// -------------------------------------------------------------
// E-SIGN VERIFICATION HANDLERS (ZERO DISK / PII STORED)
// -------------------------------------------------------------

/**
 * Upload Document for E-Sign - Pure in-memory forwarding (Zero disk retention)
 */
const uploadEsignDocument = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await providerService.uploadEsignDocument({
      documentBuffer: req.file.buffer,
      filename: req.file.originalname || "document.pdf",
      environment,
    });

    const mapped = {
      status: providerResponse.status || "SUCCESS",
      documentId: providerResponse.document_id,
      filename: req.file.originalname || "document.pdf",
      sizeBytes: req.file.size || req.file.buffer.length,
      message: "Document uploaded successfully for E-Sign",
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "ESIGN",
      action: "DOCUMENT_UPLOAD",
      endpoint: req.originalUrl || "/api/esign/document/upload",
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
      service: "ESIGN",
      action: "DOCUMENT_UPLOAD",
      endpoint: req.originalUrl || "/api/esign/document/upload",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "E-Sign document upload failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Wraps Cashfree signing links into white-labeled OneInfo gateway links
 */
const wrapSigningLink = (originalUrl, environment = "sandbox") => {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;

  try {
    const parsed = new URL(originalUrl);
    const baseUrl = (process.env.ONEINFO_BASE_URL || "https://kyc.oneinfo.ai").replace(/\/+$/, "");

    const params = new URLSearchParams(parsed.search);
    if (environment === "sandbox" && !params.has("env")) {
      params.set("env", "sandbox");
    }

    const queryStr = params.toString() ? `?${params.toString()}` : "";
    return `${baseUrl}/esign${queryStr}`;
  } catch {
    const baseUrl = (process.env.ONEINFO_BASE_URL || "https://kyc.oneinfo.ai").replace(/\/+$/, "");
    return originalUrl.replace(/https?:\/\/[^/]+(?:\.cashfree\.com\/esign|\/esign)/i, `${baseUrl}/esign`);
  }
};

/**
 * Wraps signed document download URL into white-labeled OneInfo endpoint
 */
const wrapSignedDocUrl = (originalUrl, verificationId) => {
  if (!originalUrl || typeof originalUrl !== "string") return originalUrl;
  if (!originalUrl.toLowerCase().includes("cashfree")) return originalUrl;

  const baseUrl = (process.env.ONEINFO_BASE_URL || "https://kyc.oneinfo.ai").replace(/\/+$/, "");
  return `${baseUrl}/api/esign/download/${verificationId}`;
};

/**
 * Redirects white-labeled /esign link to the provider signing interface
 */
const handleEsignRedirect = (req, res) => {
  const shortCode = req.query.shortCode || req.query.code;
  if (!shortCode) {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid signing link shortCode parameter",
    });
  }

  const isSandbox =
    req.query.env === "sandbox" ||
    req.query.mode === "sandbox" ||
    req.query.environment === "sandbox";

  const host = isSandbox
    ? "verification-test.cashfree.com"
    : "verification.cashfree.com";

  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!["env", "mode", "environment"].includes(key)) {
      queryParams.set(key, value);
    }
  }

  const targetUrl = `https://${host}/esign?${queryParams.toString()}`;
  return res.redirect(302, targetUrl);
};

/**
 * Streams the verified signed document with white-labeled headers
 */
const downloadSignedDocument = async (req, res) => {
  const { verificationId } = req.params;
  const environment = req.environment || req.query.env || "sandbox";

  try {
    const statusData = await providerService.getEsignStatus({
      verificationId,
      environment,
    });

    if (!statusData.signed_doc_url) {
      return res.status(404).json({
        success: false,
        message: "Signed document is not yet available for this verification ID.",
      });
    }

    const axios = require("axios");
    const docStream = await axios.get(statusData.signed_doc_url, {
      responseType: "stream",
      timeout: 30000,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="signed_document_${verificationId}.pdf"`
    );

    return docStream.data.pipe(res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to download signed document",
      error: error.message,
    });
  }
};

/**
 * Create E-Sign Request - Pure in-memory verification request
 */
const createEsignRequest = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const verificationId =
    req.body.verificationId ||
    req.body.verification_id ||
    `oneinfo-esign-${Date.now()}`;
  const documentId = req.body.documentId ?? req.body.document_id;
  const notificationModes =
    req.body.notificationModes ?? req.body.notification_modes ?? [];
  const authType = req.body.authType ?? req.body.auth_type ?? "AADHAAR";
  const expiryInDays = req.body.expiryInDays ?? req.body.expiry_in_days ?? "2";
  const captureLocation =
    req.body.captureLocation ?? req.body.capture_location ?? false;
  const signers = req.body.signers || [];
  const redirectUrl = req.body.redirectUrl ?? req.body.redirect_url;

  try {
    const providerResponse = await providerService.createEsignRequest({
      verificationId,
      documentId,
      notificationModes,
      authType,
      expiryInDays,
      captureLocation,
      signers,
      redirectUrl,
      environment,
    });

    const mapped = {
      status: providerResponse.status || "SUCCESS",
      verificationId: providerResponse.verification_id || verificationId,
      referenceId: providerResponse.reference_id,
      documentId: providerResponse.document_id || documentId,
      signingLink: wrapSigningLink(providerResponse.signing_link, environment),
      expiryInDays: String(expiryInDays),
      authType,
      signersCount: signers.length,
      message: "E-sign request created successfully",
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "ESIGN",
      action: "REQUEST_CREATE",
      endpoint: req.originalUrl || "/api/esign/request",
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
      service: "ESIGN",
      action: "REQUEST_CREATE",
      endpoint: req.originalUrl || "/api/esign/request",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to create E-sign request",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Get E-Sign Status
 */
const getEsignStatus = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const verificationId =
    req.verificationId ||
    req.params.verificationId ||
    req.query.verificationId ||
    req.query.verification_id;
  const referenceId =
    req.referenceId || req.query.referenceId || req.query.reference_id;

  try {
    const providerResponse = await providerService.getEsignStatus({
      verificationId,
      referenceId,
      environment,
    });

    const mapped = {
      status: providerResponse.status,
      verificationId: providerResponse.verification_id || verificationId || null,
      referenceId: providerResponse.reference_id,
      documentId: providerResponse.document_id,
      signers: (providerResponse.signers || []).map((s) => ({
        name: s.name,
        status: s.status,
        isNotified: s.is_notified ?? false,
        metaData: s.meta_data
          ? {
              name: s.meta_data.name,
              gender: s.meta_data.gender,
              yearOfBirth: s.meta_data.year_of_birth,
              postalCode: s.meta_data.postal_code,
              state: s.meta_data.state,
              country: s.meta_data.country,
              serialNumber: s.meta_data.serial_number,
              ipAddress: s.meta_data.ip_address,
              latitude: s.meta_data.latitude,
              longitude: s.meta_data.longitude,
              signingTime: s.meta_data.signing_time,
              aadhaarLastFourDigit: s.meta_data.aadhaar_last_four_digit,
            }
          : null,
      })),
      signedDocUrl: wrapSignedDocUrl(providerResponse.signed_doc_url, verificationId),
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "ESIGN",
      action: "STATUS_CHECK",
      endpoint:
        req.originalUrl ||
        (verificationId
          ? `/api/esign/status/${verificationId}`
          : "/api/esign/status"),
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
      service: "ESIGN",
      action: "STATUS_CHECK",
      endpoint:
        req.originalUrl ||
        (verificationId
          ? `/api/esign/status/${verificationId}`
          : "/api/esign/status"),
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Failed to retrieve E-sign verification status",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Check Face Liveness - Pure in-memory verification (ZERO biometric data retained)
 */
const checkFaceLiveness = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const verificationId =
    req.verificationId ||
    req.body.verification_id ||
    req.body.verificationId ||
    `face_${Date.now()}`;

  try {
    const providerResponse = await providerService.checkFaceLiveness({
      verificationId,
      imageBuffer: req.file.buffer,
      filename: req.file.originalname || "face.jpg",
      mimeType: req.file.mimetype || "image/jpeg",
      environment,
    });

    const mapped = {
      status: providerResponse.status,
      verificationId: providerResponse.verification_id || verificationId,
      referenceId: providerResponse.reference_id,
      liveness: providerResponse.liveness,
      livenessScore: providerResponse.liveness_score,
      gender: providerResponse.gender
        ? {
            value: providerResponse.gender.value,
            confidence: providerResponse.gender.confidence,
          }
        : null,
      ageRange: providerResponse.age_range
        ? {
            min: providerResponse.age_range.min,
            max: providerResponse.age_range.max,
          }
        : null,
      eyeWear: providerResponse.eye_wear
        ? {
            value: providerResponse.eye_wear.value,
            confidence: providerResponse.eye_wear.confidence,
          }
        : null,
      faceOccluded: providerResponse.face_occluded
        ? {
            value: providerResponse.face_occluded.value,
            confidence: providerResponse.face_occluded.confidence,
          }
        : null,
      quality: providerResponse.quality
        ? {
            blur: providerResponse.quality.blur,
            bright: providerResponse.quality.bright,
            exposure: providerResponse.quality.exposure,
          }
        : null,
      pose: providerResponse.pose
        ? {
            faceAlignment: providerResponse.pose.face_alignment,
            headTurned: providerResponse.pose.head_turned,
          }
        : null,
      eyesOpen: providerResponse.eyes_open
        ? {
            value: providerResponse.eyes_open.value,
            confidence: providerResponse.eyes_open.confidence,
          }
        : null,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "FACE",
      action: "LIVENESS_CHECK",
      endpoint: req.originalUrl || "/api/face/liveness",
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
      service: "FACE",
      action: "LIVENESS_CHECK",
      endpoint: req.originalUrl || "/api/face/liveness",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Face liveness verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Verify GSTIN - Pure in-memory verification (ZERO business data retained)
 */
const verifyGstin = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const gstin = req.gstin || req.body.gstin || req.body.GSTIN;
  const businessName = req.body.businessName || req.body.business_name;
  const verificationId =
    req.verificationId ||
    req.body.verificationId ||
    req.body.verification_id ||
    `gstin_${Date.now()}`;

  try {
    const providerResponse = await providerService.verifyGstin({
      gstin,
      businessName,
      environment,
    });

    const mapped = {
      verificationId,
      referenceId: providerResponse.reference_id,
      gstin: providerResponse.GSTIN,
      legalNameOfBusiness: providerResponse.legal_name_of_business,
      tradeNameOfBusiness: providerResponse.trade_name_of_business,
      centerJurisdiction: providerResponse.center_jurisdiction,
      stateJurisdiction: providerResponse.state_jurisdiction,
      dateOfRegistration: providerResponse.date_of_registration,
      constitutionOfBusiness: providerResponse.constitution_of_business,
      taxpayerType: providerResponse.taxpayer_type,
      gstInStatus: providerResponse.gst_in_status,
      lastUpdateDate: providerResponse.last_update_date,
      natureOfBusinessActivities:
        providerResponse.nature_of_business_activities || [],
      principalPlaceAddress: providerResponse.principal_place_address,
      principalPlaceSplitAddress: providerResponse.principal_place_split_address
        ? {
            buildingName:
              providerResponse.principal_place_split_address.building_name,
            street: providerResponse.principal_place_split_address.street,
            location: providerResponse.principal_place_split_address.location,
            buildingNumber:
              providerResponse.principal_place_split_address.building_number,
            district: providerResponse.principal_place_split_address.district,
            state: providerResponse.principal_place_split_address.state,
            city: providerResponse.principal_place_split_address.city,
            flatNumber:
              providerResponse.principal_place_split_address.flat_number,
            latitude: providerResponse.principal_place_split_address.latitude,
            longitude: providerResponse.principal_place_split_address.longitude,
            pincode: providerResponse.principal_place_split_address.pincode,
          }
        : null,
      additionalAddressArray: (
        providerResponse.additional_address_array || []
      ).map((item) => ({
        address: item.address,
        splitAddress: item.split_address
          ? {
              buildingName: item.split_address.building_name,
              street: item.split_address.street,
              location: item.split_address.location,
              buildingNumber: item.split_address.building_number,
              district: item.split_address.district,
              state: item.split_address.state,
              city: item.split_address.city,
              flatNumber: item.split_address.flat_number,
              latitude: item.split_address.latitude,
              longitude: item.split_address.longitude,
              pincode: item.split_address.pincode,
            }
          : null,
      })),
      valid: providerResponse.valid,
      message: providerResponse.message,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "GSTIN",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/gstin/verify",
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
      service: "GSTIN",
      action: "VERIFY",
      endpoint: req.originalUrl || "/api/gstin/verify",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "GSTIN verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Mobile 360 - Send OTP (Pure in-memory, zero data retention)
 */
const sendMobileOtp = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const mobileNumber = req.mobileNumber || req.body.mobile_number || req.body.mobileNumber;
  const verificationId = req.verificationId || req.body.verification_id || req.body.verificationId;
  const name = req.body.name;
  const notificationModes = req.body.notification_modes || req.body.notificationModes || ["SMS"];
  const userConsent = req.body.user_consent || req.body.userConsent;

  try {
    const providerResponse = await providerService.sendMobileOtp({
      verificationId,
      mobileNumber,
      name,
      notificationModes,
      userConsent,
      environment,
    });

    const mapped = {
      verificationId: providerResponse.verification_id,
      mobileNumber: providerResponse.mobile_number,
      status: providerResponse.status,
      referenceId: providerResponse.reference_id,
      name: providerResponse.name || name || null,
      notificationModes: providerResponse.notification_modes || notificationModes,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "MOBILE360",
      action: "SEND_OTP",
      endpoint: req.originalUrl || "/api/mobile360/otp/send",
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
      service: "MOBILE360",
      action: "SEND_OTP",
      endpoint: req.originalUrl || "/api/mobile360/otp/send",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Mobile 360 OTP generation failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Mobile 360 - Verify OTP (Pure in-memory, zero data retention)
 */
const verifyMobileOtp = async (req, res) => {
  const startTime = Date.now();
  const environment = req.environment || "sandbox";
  const verificationId = req.verificationId || req.body.verification_id || req.body.verificationId;
  const otp = req.otp || req.body.otp;

  try {
    const providerResponse = await providerService.verifyMobileOtp({
      verificationId,
      otp,
      environment,
    });

    const mapped = {
      verificationId: providerResponse.verification_id,
      referenceId: providerResponse.reference_id,
      status: providerResponse.status,
      creditScore: providerResponse.credit_score ?? null,
      personalDetails: providerResponse.personal_details
        ? {
            fullName: providerResponse.personal_details.full_name,
            gender: providerResponse.personal_details.gender,
            totalIncome: providerResponse.personal_details.total_income,
            occupation: providerResponse.personal_details.occupation,
            age: providerResponse.personal_details.age,
            dob: providerResponse.personal_details.dob,
            relativesDetails: providerResponse.personal_details.relatives_details || [],
          }
        : null,
      phoneNumbers: (providerResponse.phone_numbers || []).map((p) => ({
        type: p.type,
        phone: p.phone,
        linkedTo: p.linked_to,
      })),
      emails: (providerResponse.emails || []).map((e) => ({
        email: e.email,
        linkedTo: e.linked_to,
      })),
      addresses: (providerResponse.addresses || []).map((a) => ({
        address: a.address,
        type: a.type,
        state: a.state,
        pincode: a.pincode,
        city: a.city,
        street: a.street,
        country: a.country,
        linkedTo: a.linked_to,
      })),
      panDetails: (providerResponse.pan_details || []).map((p) => ({
        panNumber: p.pan_number,
        metadata: p.metadata,
      })),
      bankAccountDetails: (providerResponse.bank_account_details || []).map((b) => ({
        bankAccount: b.bank_account,
        ifsc: b.ifsc,
        bankAddress: b.bank_address,
        linkedTo: b.linked_to,
      })),
      aadhaarDetails: (providerResponse.aadhaar_details || []).map((a) => ({
        maskedAadhaarNumber: a.masked_aadhaar_number,
        linkedTo: a.linked_to,
      })),
      passportDetails: (providerResponse.passport_details || []).map((p) => ({
        passportNumber: p.passport_number,
        linkedTo: p.linked_to,
      })),
      voterDetails: (providerResponse.voter_details || []).map((v) => ({
        voterId: v.voter_id,
        linkedTo: v.linked_to,
      })),
      rationCardDetails: (providerResponse.ration_card_details || []).map((r) => ({
        rationCardNumber: r.ration_card_number,
        linkedTo: r.linked_to,
      })),
      drivingLicenseDetails: (providerResponse.driving_license_details || []).map((d) => ({
        drivingLicenseNumber: d.driving_license_number,
        linkedTo: d.linked_to,
      })),
      employmentDetails: providerResponse.employment_details || null,
      mobileNumberIntelligence: providerResponse.mobile_number_intelligence
        ? {
            isValidNumber: providerResponse.mobile_number_intelligence.is_valid_number,
            subscriberStatus: providerResponse.mobile_number_intelligence.subscriber_status,
            connectionType: providerResponse.mobile_number_intelligence.connection_type,
            currentServiceProvider: providerResponse.mobile_number_intelligence.current_service_provider,
            originalServiceProvider: providerResponse.mobile_number_intelligence.original_service_provider,
            networkRegion: providerResponse.mobile_number_intelligence.network_region,
            isPorted: providerResponse.mobile_number_intelligence.is_ported,
          }
        : null,
      riskIntelligence: providerResponse.risk_intelligence
        ? {
            isSafe: providerResponse.risk_intelligence.is_safe,
            riskLevel: providerResponse.risk_intelligence.risk_level,
            riskReason: providerResponse.risk_intelligence.risk_reason,
            riskDescription: providerResponse.risk_intelligence.risk_description,
            overallRiskLevel: providerResponse.risk_intelligence.overall_risk_level,
            addedOn: providerResponse.risk_intelligence.added_on,
            lastUpdatedOn: providerResponse.risk_intelligence.last_updated_on,
          }
        : null,
    };

    analyticsService.recordEvent({
      client: req.client,
      service: "MOBILE360",
      action: "VERIFY_OTP",
      endpoint: req.originalUrl || "/api/mobile360/otp/verify",
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
      service: "MOBILE360",
      action: "VERIFY_OTP",
      endpoint: req.originalUrl || "/api/mobile360/otp/verify",
      environment,
      status: "FAILURE",
      statusCode: status,
      responseTimeMs: Date.now() - startTime,
      errorMessage: providerMessage,
    });

    return res.status(status).json({
      success: false,
      environment,
      message: "Mobile 360 OTP verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

module.exports = {
  verifyPan,
  verifyAadhaar,
  initiateDigiLocker,
  getDigiLockerStatus,
  getAadhaarDocument,
  uploadEsignDocument,
  createEsignRequest,
  getEsignStatus,
  checkFaceLiveness,
  verifyGstin,
  sendMobileOtp,
  verifyMobileOtp,
  handleEsignRedirect,
  downloadSignedDocument,
  wrapSigningLink,
  wrapSignedDocUrl,
  getAnalyticsSummary,
  createApiClient,
  listApiClients,
};
