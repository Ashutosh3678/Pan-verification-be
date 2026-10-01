const mongoose = require("mongoose");
const Analytics = require("../models/Analytics");

/**
 * Safely record an analytics event in the background (Non-blocking)
 */
const recordEvent = async ({
  client,
  service,
  action,
  endpoint,
  environment = "sandbox",
  status,
  statusCode,
  responseTimeMs = 0,
  errorMessage = null,
}) => {
  if (mongoose.connection.readyState !== 1) {
    return; // Skip if database is offline
  }

  try {
    const clientId = client?.clientId || client?.apiKey || "anonymous";
    const clientName = client?.name || "OneInfo Client";
    const cleanEndpoint = normalizeEndpointPath(endpoint);

    await Analytics.create({
      clientId,
      clientName,
      service,
      action,
      endpoint: cleanEndpoint,
      environment,
      status,
      statusCode,
      responseTimeMs,
      errorMessage: errorMessage ? String(errorMessage).slice(0, 250) : null,
    });
  } catch (err) {
    console.error("[Analytics Warning] Failed to log event:", err.message);
  }
};

/**
 * Normalizes endpoint paths to standard clean keys
 */
const normalizeEndpointPath = (rawEndpoint) => {
  if (!rawEndpoint) return "/unknown";
  if (rawEndpoint.includes("/pan/verify")) return "/pan/verify";
  if (rawEndpoint.includes("/aadhaar/verify")) return "/aadhaar/verify";
  if (rawEndpoint.includes("/aadhaar/initiate") || rawEndpoint.includes("/aadhaar/create-url"))
    return "/aadhaar/initiate";
  if (rawEndpoint.includes("/aadhaar/status")) return "/aadhaar/status";
  if (rawEndpoint.includes("/aadhaar/document")) return "/aadhaar/document";
  return rawEndpoint;
};

/**
 * Get comprehensive analytics summary with separate sandbox vs production breakdowns
 */
const getSummary = async ({ clientId, environment, timeframeDays = 30 }) => {
  // Always refresh dotenv to get the latest limits and flags
  require("dotenv").config({ override: true });

  const panDailyLimit = Number(process.env.PROD_PAN_DAILY_LIMIT) || 100;
  const aadhaarDailyLimit = Number(process.env.PROD_AADHAAR_DAILY_LIMIT) || 50;
  const isProdPanEnabled = process.env.ENABLE_PROD_PAN !== "false";
  const isProdAadhaarEnabled = process.env.ENABLE_PROD_AADHAAR !== "false";

  if (mongoose.connection.readyState !== 1) {
    return {
      message: "Database is currently offline. Operating in pure in-memory mode.",
      guardrails: {
        production: {
          pan: { enabled: isProdPanEnabled, todayUsed: 0, dailyLimit: panDailyLimit, remaining: panDailyLimit },
          aadhaar: { enabled: isProdAadhaarEnabled, todayUsed: 0, dailyLimit: aadhaarDailyLimit, remaining: aadhaarDailyLimit },
        },
      },
      totalsByEnvironment: {
        sandbox: { totalRequests: 0, success: 0, failure: 0, successRate: "0.00%" },
        production: { totalRequests: 0, success: 0, failure: 0, successRate: "0.00%" },
      },
      aadhaarEndpointBreakdown: {},
      panEndpointBreakdown: {},
      recentActivity: [],
    };
  }

  const query = {};
  if (clientId) query.clientId = clientId;
  if (environment) query.environment = environment;

  if (timeframeDays) {
    const since = new Date();
    since.setDate(since.getDate() - Number(timeframeDays));
    query.createdAt = { $gte: since };
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Run aggregations in parallel for maximum speed
  const [
    panTodayUsed,
    aadhaarTodayUsed,
    envTotals,
    endpointStats,
    recentEvents,
  ] = await Promise.all([
    // 1. Guardrail quota counts today
    Analytics.countDocuments({
      service: "PAN",
      environment: "production",
      createdAt: { $gte: startOfDay },
    }),
    Analytics.countDocuments({
      service: "AADHAAR",
      environment: "production",
      createdAt: { $gte: startOfDay },
    }),

    // 2. Totals separated strictly by environment (Sandbox vs Production)
    Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$environment",
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failure: {
            $sum: { $cond: [{ $eq: ["$status", "FAILURE"] }, 1, 0] },
          },
        },
      },
    ]),

    // 3. Breakdown per endpoint and per environment
    Analytics.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            endpoint: "$endpoint",
            environment: "$environment",
            service: "$service",
          },
          requests: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ["$status", "SUCCESS"] }, 1, 0] },
          },
          failure: {
            $sum: { $cond: [{ $eq: ["$status", "FAILURE"] }, 1, 0] },
          },
          avgLatencyMs: { $avg: "$responseTimeMs" },
        },
      },
    ]),

    // 4. Recent Activity (last 20 requests)
    Analytics.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .select("-__v"),
  ]);

  // Format Environment Totals
  const formatEnvStats = (data) => {
    const total = data?.total || 0;
    const success = data?.success || 0;
    const failure = data?.failure || 0;
    const successRate = total > 0 ? `${((success / total) * 100).toFixed(2)}%` : "0.00%";
    return { totalRequests: total, success, failure, successRate };
  };

  const sandboxRaw = envTotals.find((e) => e._id === "sandbox");
  const prodRaw = envTotals.find((e) => e._id === "production");

  // Format Endpoint Breakdowns
  const aadhaarEndpoints = {
    "/aadhaar/verify": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/aadhaar/initiate": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/aadhaar/status": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/aadhaar/document": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  const panEndpoints = {
    "/pan/verify": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  for (const item of endpointStats) {
    const normalized = normalizeEndpointPath(item._id.endpoint);
    const env = item._id.environment === "production" ? "production" : "sandbox";
    const targetMap = item._id.service === "PAN" ? panEndpoints : aadhaarEndpoints;

    if (!targetMap[normalized]) {
      targetMap[normalized] = {
        sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 },
        production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 },
      };
    }

    targetMap[normalized][env].requests += item.requests;
    targetMap[normalized][env].success += item.success;
    targetMap[normalized][env].failure += item.failure;
    targetMap[normalized][env].avgLatencyMs = Math.round(item.avgLatencyMs || 0);
  }

  return {
    timeframe: `Past ${timeframeDays} days`,
    guardrails: {
      production: {
        pan: {
          enabled: isProdPanEnabled,
          todayUsed: panTodayUsed,
          dailyLimit: panDailyLimit,
          remaining: Math.max(0, panDailyLimit - panTodayUsed),
        },
        aadhaar: {
          enabled: isProdAadhaarEnabled,
          todayUsed: aadhaarTodayUsed,
          dailyLimit: aadhaarDailyLimit,
          remaining: Math.max(0, aadhaarDailyLimit - aadhaarTodayUsed),
        },
      },
    },
    totalsByEnvironment: {
      sandbox: formatEnvStats(sandboxRaw),
      production: formatEnvStats(prodRaw),
    },
    aadhaarEndpointBreakdown: aadhaarEndpoints,
    panEndpointBreakdown: panEndpoints,
    recentActivity: recentEvents,
  };
};

module.exports = {
  recordEvent,
  getSummary,
};
