const cashfreeService = require("../services/cashfree.service");

/**
 * Pure in-memory Face Liveness Check - NO data stored in DB or disk
 */
const checkLiveness = async (req, res) => {
  const environment = req.environment || "sandbox";
  const verificationId =
    req.verificationId ||
    req.body.verification_id ||
    req.body.verificationId ||
    `face_${Date.now()}`;

  try {
    const providerResponse = await cashfreeService.checkFaceLiveness({
      verificationId,
      imageBuffer: req.file.buffer,
      filename: req.file.originalname || "face.jpg",
      mimeType: req.file.mimetype || "image/jpeg",
      environment,
    });

    return res.status(200).json({
      success: true,
      environment,
      data: {
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
      message: "Face liveness verification failed",
      error: providerMessage,
      details: error.response?.data || null,
    });
  }
};

/**
 * Verification history lookup (Zero data retention policy)
 */
const getVerificationHistory = async (_req, res) => {
  return res.status(200).json({
    success: true,
    message: "Data storage is disabled. Verification history is not retained.",
    data: [],
  });
};

/**
 * Verification by ID lookup (Zero data retention policy)
 */
const getVerificationById = async (_req, res) => {
  return res.status(404).json({
    success: false,
    message: "Data storage is disabled. Verification records are not retained.",
  });
};

module.exports = {
  checkLiveness,
  getVerificationHistory,
  getVerificationById,
};
