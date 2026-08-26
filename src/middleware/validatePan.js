const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const validatePanRequest = (req, res, next) => {
  const { pan, name } = req.body;
  const errors = [];

  if (!pan || !PAN_REGEX.test(String(pan).toUpperCase())) {
    errors.push(
      "pan is required and must be a valid 10-character PAN (e.g. ABCPV1234D)"
    );
  }

  if (name !== undefined && name !== null && !String(name).trim()) {
    errors.push("name cannot be empty when provided");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  req.body.pan = String(pan).toUpperCase();
  if (name) {
    req.body.name = String(name).trim();
  }

  next();
};

module.exports = {
  validatePanRequest,
};
