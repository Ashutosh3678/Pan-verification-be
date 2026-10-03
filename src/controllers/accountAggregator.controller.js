const oneinfoController = require("./oneinfo.controller");

/**
 * Send OTP via Account Aggregator
 */
const sendOtp = async (req, res) => {
  return oneinfoController.sendMobileOtp(req, res);
};

/**
 * Verify OTP via Account Aggregator & retrieve credit/profile intelligence
 */
const verifyOtp = async (req, res) => {
  return oneinfoController.verifyMobileOtp(req, res);
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
  sendOtp,
  verifyOtp,
  getVerificationHistory,
  getVerificationById,
};
