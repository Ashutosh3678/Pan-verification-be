const mongoose = require("mongoose");
const ApiClient = require("../models/ApiClient");

const normalizeMode = (headerValue) => {
  if (!headerValue) return "sandbox";
  const val = String(headerValue).trim().toLowerCase();
  if (val === "prod" || val === "production") return "production";
  return "sandbox";
};

const authenticateClient = async (req, res, next) => {
  try {
    const apiKeyHeader =
      req.headers["x-api-key"] ||
      (req.headers["authorization"] &&
        req.headers["authorization"].startsWith("Bearer ")
        ? req.headers["authorization"].slice(7).trim()
        : null);

    const clientIdHeader = req.headers["x-client-id"];
    const clientSecretHeader = req.headers["x-client-secret"];

    if (!apiKeyHeader && (!clientIdHeader || !clientSecretHeader)) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required. Provide 'x-client-id' & 'x-client-secret' headers.",
      });
    }

    const requestedMode = normalizeMode(
      req.headers["x-environment"] || req.headers["x-mode"]
    );

    // 1. Check Master API Key if defined in environment variables
    const masterKey = process.env.ONEINFO_MASTER_API_KEY;
    if (masterKey && apiKeyHeader && apiKeyHeader === masterKey) {
      req.client = {
        name: "Master Admin",
        apiKey: masterKey,
        allowedModes: ["sandbox", "production"],
        isMaster: true,
      };
      req.environment = requestedMode;
      return next();
    }

    // 2. Query ApiClient from database
    let client = null;
    if (mongoose.connection.readyState === 1) {
      if (apiKeyHeader) {
        client = await ApiClient.findOne({
          apiKey: apiKeyHeader,
          isActive: true,
        });
      } else if (clientIdHeader && clientSecretHeader) {
        client = await ApiClient.findOne({
          clientId: clientIdHeader,
          clientSecret: clientSecretHeader,
          isActive: true,
        });
      }
    }


    if (!client) {
      return res.status(401).json({
        success: false,
        message: "Authentication failed: Invalid or inactive API credentials.",
      });
    }

    // Check if client is permitted to use the requested environment
    if (
      Array.isArray(client.allowedModes) &&
      client.allowedModes.length > 0 &&
      !client.allowedModes.includes(requestedMode)
    ) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Client is not permitted to access '${requestedMode}' environment.`,
      });
    }

    req.client = client;
    req.environment = requestedMode;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal authentication error",
      error: error.message,
    });
  }
};

const authenticateAdmin = async (req, res, next) => {
  const adminKey =
    req.headers["x-admin-key"] ||
    req.headers["x-api-key"] ||
    (req.headers["authorization"] &&
      req.headers["authorization"].startsWith("Bearer ")
      ? req.headers["authorization"].slice(7).trim()
      : null);

  const configuredMasterKey = process.env.ONEINFO_MASTER_API_KEY;

  if (configuredMasterKey && adminKey === configuredMasterKey) {
    return next();
  }

  // If no master key configured, allow checking ApiClient master/admin
  if (adminKey) {
    const client = await ApiClient.findOne({ apiKey: adminKey, isActive: true });
    if (client) {
      req.client = client;
      return next();
    }
  }

  // If running in development and no master key configured, allow setup
  if (process.env.NODE_ENV !== "production" && !configuredMasterKey) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Admin authentication required. Provide valid 'x-admin-key'.",
  });
};

module.exports = {
  authenticateClient,
  authenticateAdmin,
};
