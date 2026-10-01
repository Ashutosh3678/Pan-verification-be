const cashfreeService = require("../services/cashfree.service");

const mapResponse = (data, verificationId, requestedName) => ({
  verificationId,
  referenceId: data.reference_id,
  pan: data.pan,
  type: data.type,
  nameProvided: data.name_provided ?? requestedName ?? null,
  registeredName: data.registered_name,
  valid: data.valid,
  message: data.message,
  nameMatchScore: data.name_match_score,
  nameMatchResult: data.name_match_result,
  panStatus: data.pan_status,
  aadhaarSeedingStatus: data.aadhaar_seeding_status,
  aadhaarSeedingStatusDesc: data.aadhaar_seeding_status_desc,
  lastUpdatedAt: data.last_updated_at,
  namePanCard: data.name_pan_card,
  fatherName: data.father_name,
});

/**
 * Pure in-memory verification - NO data stored in DB
 */
const verifyPan = async (req, res) => {
  const { pan, name } = req.body;
  const environment = req.environment || "sandbox";
  const verificationId = req.body.verificationId || `pan-${Date.now()}`;

  try {
    const providerResponse = await cashfreeService.verifyPan({
      pan,
      name,
      environment,
    });
    const mapped = mapResponse(providerResponse, verificationId, name);

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
      message: "PAN verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
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
  verifyPan,
  getVerificationHistory,
  getVerificationById,
};
