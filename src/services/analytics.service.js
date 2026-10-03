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
  if (rawEndpoint.includes("/esign/document/upload") || rawEndpoint.includes("/esign/upload"))
    return "/esign/document/upload";
  if (rawEndpoint.includes("/esign/request") || rawEndpoint.includes("/esign/create"))
    return "/esign/request";
  if (rawEndpoint.includes("/esign/status")) return "/esign/status";
  if (rawEndpoint.includes("/face/liveness") || rawEndpoint.includes("/face/check"))
    return "/face/liveness";
  if (rawEndpoint.includes("/gstin/verify") || rawEndpoint.includes("/gstin"))
    return "/gstin/verify";
  if (
    rawEndpoint.includes("/account-aggregator/otp/send") ||
    rawEndpoint.includes("/accountaggregator/otp/send") ||
    rawEndpoint.includes("/mobile360/otp/send") ||
    rawEndpoint.includes("/mobile360/send")
  )
    return "/account-aggregator/otp/send";
  if (
    rawEndpoint.includes("/account-aggregator/otp/verify") ||
    rawEndpoint.includes("/accountaggregator/otp/verify") ||
    rawEndpoint.includes("/mobile360/otp/verify") ||
    rawEndpoint.includes("/mobile360/verify")
  )
    return "/account-aggregator/otp/verify";
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
  const esignDailyLimit = Number(process.env.PROD_ESIGN_DAILY_LIMIT) || 50;
  const faceDailyLimit = Number(process.env.PROD_FACE_DAILY_LIMIT) || 50;
  const gstinDailyLimit = Number(process.env.PROD_GSTIN_DAILY_LIMIT) || 100;
  const mobile360DailyLimit = Number(process.env.PROD_MOBILE360_DAILY_LIMIT) || 50;
  const isProdPanEnabled = process.env.ENABLE_PROD_PAN !== "false";
  const isProdAadhaarEnabled = process.env.ENABLE_PROD_AADHAAR !== "false";
  const isProdEsignEnabled = process.env.ENABLE_PROD_ESIGN !== "false";
  const isProdFaceEnabled = process.env.ENABLE_PROD_FACE !== "false";
  const isProdGstinEnabled = process.env.ENABLE_PROD_GSTIN !== "false";
  const isProdMobile360Enabled = process.env.ENABLE_PROD_MOBILE360 !== "false";

  if (mongoose.connection.readyState !== 1) {
    return {
      message: "Database is currently offline. Operating in pure in-memory mode.",
      guardrails: {
        production: {
          pan: { enabled: isProdPanEnabled, todayUsed: 0, dailyLimit: panDailyLimit, remaining: panDailyLimit },
          aadhaar: { enabled: isProdAadhaarEnabled, todayUsed: 0, dailyLimit: aadhaarDailyLimit, remaining: aadhaarDailyLimit },
          esign: { enabled: isProdEsignEnabled, todayUsed: 0, dailyLimit: esignDailyLimit, remaining: esignDailyLimit },
          face: { enabled: isProdFaceEnabled, todayUsed: 0, dailyLimit: faceDailyLimit, remaining: faceDailyLimit },
          gstin: { enabled: isProdGstinEnabled, todayUsed: 0, dailyLimit: gstinDailyLimit, remaining: gstinDailyLimit },
          accountAggregator: { enabled: isProdMobile360Enabled, todayUsed: 0, dailyLimit: mobile360DailyLimit, remaining: mobile360DailyLimit },
          mobile360: { enabled: isProdMobile360Enabled, todayUsed: 0, dailyLimit: mobile360DailyLimit, remaining: mobile360DailyLimit },
        },
      },
      totalsByEnvironment: {
        sandbox: { totalRequests: 0, success: 0, failure: 0, successRate: "0.00%" },
        production: { totalRequests: 0, success: 0, failure: 0, successRate: "0.00%" },
      },
      aadhaarEndpointBreakdown: {},
      panEndpointBreakdown: {},
      esignEndpointBreakdown: {},
      faceEndpointBreakdown: {},
      gstinEndpointBreakdown: {},
      accountAggregatorEndpointBreakdown: {},
      mobile360EndpointBreakdown: {},
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
    esignTodayUsed,
    faceTodayUsed,
    gstinTodayUsed,
    mobile360TodayUsed,
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
    Analytics.countDocuments({
      service: "ESIGN",
      environment: "production",
      createdAt: { $gte: startOfDay },
    }),
    Analytics.countDocuments({
      service: "FACE",
      environment: "production",
      createdAt: { $gte: startOfDay },
    }),
    Analytics.countDocuments({
      service: "GSTIN",
      environment: "production",
      createdAt: { $gte: startOfDay },
    }),
    Analytics.countDocuments({
      service: "MOBILE360",
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

  const esignEndpoints = {
    "/esign/document/upload": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/esign/request": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/esign/status": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  const faceEndpoints = {
    "/face/liveness": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  const gstinEndpoints = {
    "/gstin/verify": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  const accountAggregatorEndpoints = {
    "/account-aggregator/otp/send": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
    "/account-aggregator/otp/verify": { sandbox: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 }, production: { requests: 0, success: 0, failure: 0, avgLatencyMs: 0 } },
  };

  for (const item of endpointStats) {
    const normalized = normalizeEndpointPath(item._id.endpoint);
    const env = item._id.environment === "production" ? "production" : "sandbox";
    const targetMap =
      item._id.service === "PAN"
        ? panEndpoints
        : item._id.service === "ESIGN"
        ? esignEndpoints
        : item._id.service === "FACE"
        ? faceEndpoints
        : item._id.service === "GSTIN"
        ? gstinEndpoints
        : item._id.service === "MOBILE360" || item._id.service === "ACCOUNT_AGGREGATOR"
        ? accountAggregatorEndpoints
        : aadhaarEndpoints;

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
        esign: {
          enabled: isProdEsignEnabled,
          todayUsed: esignTodayUsed,
          dailyLimit: esignDailyLimit,
          remaining: Math.max(0, esignDailyLimit - esignTodayUsed),
        },
        face: {
          enabled: isProdFaceEnabled,
          todayUsed: faceTodayUsed,
          dailyLimit: faceDailyLimit,
          remaining: Math.max(0, faceDailyLimit - faceTodayUsed),
        },
        gstin: {
          enabled: isProdGstinEnabled,
          todayUsed: gstinTodayUsed,
          dailyLimit: gstinDailyLimit,
          remaining: Math.max(0, gstinDailyLimit - gstinTodayUsed),
        },
        accountAggregator: {
          enabled: isProdMobile360Enabled,
          todayUsed: mobile360TodayUsed,
          dailyLimit: mobile360DailyLimit,
          remaining: Math.max(0, mobile360DailyLimit - mobile360TodayUsed),
        },
        mobile360: {
          enabled: isProdMobile360Enabled,
          todayUsed: mobile360TodayUsed,
          dailyLimit: mobile360DailyLimit,
          remaining: Math.max(0, mobile360DailyLimit - mobile360TodayUsed),
        },
      },
    },
    totalsByEnvironment: {
      sandbox: formatEnvStats(sandboxRaw),
      production: formatEnvStats(prodRaw),
    },
    aadhaarEndpointBreakdown: aadhaarEndpoints,
    panEndpointBreakdown: panEndpoints,
    esignEndpointBreakdown: esignEndpoints,
    faceEndpointBreakdown: faceEndpoints,
    gstinEndpointBreakdown: gstinEndpoints,
    accountAggregatorEndpointBreakdown: accountAggregatorEndpoints,
    mobile360EndpointBreakdown: accountAggregatorEndpoints,
    recentActivity: recentEvents,
  };
};

module.exports = {
  recordEvent,
  getSummary,
};
