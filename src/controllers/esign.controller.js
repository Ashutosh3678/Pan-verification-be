const cashfreeService = require("../services/cashfree.service");
const {
  wrapSigningLink,
  wrapSignedDocUrl,
} = require("./oneinfo.controller");

/**
 * Pure in-memory document upload - NO data stored in DB or disk
 */
const uploadDocument = async (req, res) => {
  const environment = req.environment || "sandbox";

  try {
    const providerResponse = await cashfreeService.uploadEsignDocument({
      documentBuffer: req.file.buffer,
      filename: req.file.originalname || "document.pdf",
      environment,
    });

    return res.status(200).json({
      success: true,
      environment,
      data: {
        status: providerResponse.status || "SUCCESS",
        documentId: providerResponse.document_id,
        filename: req.file.originalname || "document.pdf",
        sizeBytes: req.file.size || req.file.buffer.length,
        message: "Document uploaded successfully for E-Sign",
      },
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
      message: "E-Sign document upload failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Pure in-memory E-Sign request creation - NO data stored in DB
 */
const createRequest = async (req, res) => {
  const environment = req.environment || "sandbox";
  const verificationId =
    req.body.verificationId ||
    req.body.verification_id ||
    `esign-${Date.now()}`;
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
    const providerResponse = await cashfreeService.createEsignRequest({
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

    return res.status(200).json({
      success: true,
      environment,
      data: {
        status: providerResponse.status || "SUCCESS",
        verificationId: providerResponse.verification_id || verificationId,
        referenceId: providerResponse.reference_id,
        documentId: providerResponse.document_id || documentId,
        signingLink: wrapSigningLink(providerResponse.signing_link, environment),
        expiryInDays: String(expiryInDays),
        authType,
        signersCount: signers.length,
        message: "E-sign request created successfully",
      },
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
      message: "Failed to create E-sign request",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Pure in-memory E-Sign status fetch - NO data stored in DB
 */
const getStatus = async (req, res) => {
  const environment = req.environment || "sandbox";
  const verificationId =
    req.verificationId ||
    req.params.verificationId ||
    req.query.verificationId ||
    req.query.verification_id;
  const referenceId =
    req.referenceId || req.query.referenceId || req.query.reference_id;

  try {
    const providerResponse = await cashfreeService.getEsignStatus({
      verificationId,
      referenceId,
      environment,
    });

    return res.status(200).json({
      success: true,
      environment,
      data: {
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
      },
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
      message: "Failed to retrieve E-sign verification status",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const handleWebhook = async (req, res) => {
  // Webhook received - we do not store customer signing data
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
  uploadDocument,
  createRequest,
  getStatus,
  handleWebhook,
  getVerificationHistory,
  getVerificationById,
};
