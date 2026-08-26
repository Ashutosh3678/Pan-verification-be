const PanVerification = require("../models/PanVerification");
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

const verifyPan = async (req, res) => {
  const { pan, name } = req.body;
  const verificationId = `pan-${Date.now()}`;

  try {
    const cashfreeResponse = await cashfreeService.verifyPan({ pan, name });
    const mapped = mapResponse(cashfreeResponse, verificationId, name);

    await PanVerification.create({
      ...mapped,
      name,
      rawResponse: cashfreeResponse,
      errorMessage: null,
    });

    return res.status(200).json({
      success: true,
      data: mapped,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const providerMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;

    await PanVerification.create({
      verificationId,
      pan,
      name,
      errorMessage: providerMessage,
      rawResponse: error.response?.data || null,
    });

    return res.status(status).json({
      success: false,
      message: "PAN verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

const getVerificationHistory = async (_req, res) => {
  const records = await PanVerification.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .select("-rawResponse");

  return res.status(200).json({
    success: true,
    data: records,
  });
};

const getVerificationById = async (req, res) => {
  const record = await PanVerification.findOne({
    verificationId: req.params.verificationId,
  }).select("-rawResponse");

  if (!record) {
    return res.status(404).json({
      success: false,
      message: "Verification record not found",
    });
  }

  return res.status(200).json({
    success: true,
    data: record,
  });
};

module.exports = {
  verifyPan,
  getVerificationHistory,
  getVerificationById,
};
