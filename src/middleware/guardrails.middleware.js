const mongoose = require("mongoose");
const Analytics = require("../models/Analytics");

// In-memory sliding window rate limiter for production calls per client
const rateLimitMap = new Map();

/**
 * Clean up rate limit map entries older than 2 minutes to prevent memory leak
 */
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => t > cutoff);
    if (valid.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, valid);
    }
  }
}, 60000);

/**
 * Guardrail middleware factory for a given service ('PAN' or 'AADHAAR')
 */
const checkGuardrail = (service) => {
  return async (req, res, next) => {
    // 1. Sandbox calls are completely unrestricted
    if (req.environment !== "production") {
      return next();
    }

    // Always refresh dotenv so flag/limit edits in .env apply in real time
    require("dotenv").config({ override: true });

    // 2. Feature Flag (Kill-switch) Check
    const isPan = service === "PAN";
    const flagKey = isPan ? "ENABLE_PROD_PAN" : "ENABLE_PROD_AADHAAR";
    const isEnabled = process.env[flagKey] !== "false";

    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        environment: "production",
        message: `Guardrail Blocked: Production ${service} verification is currently disabled by system policy.`,
      });
    }

    // 3. Rate Limit Check (per minute per client)
    const clientKey = req.client?.clientId || req.ip || "unknown_client";
    const rateLimitKey = `${clientKey}_${service}`;
    const maxPerMinute = Number(process.env.PROD_RATE_LIMIT_PER_MINUTE) || 10;
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    let timestamps = rateLimitMap.get(rateLimitKey) || [];
    timestamps = timestamps.filter((t) => t > oneMinuteAgo);

    if (timestamps.length >= maxPerMinute) {
      return res.status(429).json({
        success: false,
        environment: "production",
        message: `Rate limit exceeded: Maximum ${maxPerMinute} production ${service} requests per minute allowed.`,
      });
    }

    timestamps.push(now);
    rateLimitMap.set(rateLimitKey, timestamps);

    // 4. Daily Production Quota Cap Check (from Analytics in MongoDB)
    const limitKey = isPan ? "PROD_PAN_DAILY_LIMIT" : "PROD_AADHAAR_DAILY_LIMIT";
    const dailyLimit = Number(process.env[limitKey]) || (isPan ? 100 : 50);

    if (mongoose.connection.readyState === 1) {
      try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const usedToday = await Analytics.countDocuments({
          service,
          environment: "production",
          createdAt: { $gte: startOfDay },
        });

        if (usedToday >= dailyLimit) {
          return res.status(429).json({
            success: false,
            environment: "production",
            message: `Guardrail Blocked: Daily production limit of ${dailyLimit} ${service} verifications reached for today. (Current usage: ${usedToday}/${dailyLimit}).`,
          });
        }
      } catch (err) {
        console.warn("[Guardrail Warning] Failed to check quota against DB:", err.message);
      }
    }

    next();
  };
};

module.exports = {
  checkGuardrail,
};
