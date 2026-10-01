const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema(
  {
    clientId: {
      type: String,
      required: true,
      index: true,
    },
    clientName: {
      type: String,
      default: "Unknown Client",
    },
    service: {
      type: String,
      required: true,
      enum: ["PAN", "AADHAAR", "SYSTEM"],
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "VERIFY",
        "LINK_GENERATED",
        "LINK_CLICKED",
        "STATUS_CHECK",
        "DOCUMENT_FETCH",
      ],
      index: true,
    },
    endpoint: {
      type: String,
      required: true,
    },
    environment: {
      type: String,
      enum: ["sandbox", "production"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE"],
      required: true,
      index: true,
    },
    statusCode: {
      type: Number,
      required: true,
    },
    responseTimeMs: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast dashboard analytics aggregations
analyticsSchema.index({ createdAt: -1 });
analyticsSchema.index({ clientId: 1, createdAt: -1 });
analyticsSchema.index({ service: 1, status: 1 });
analyticsSchema.index({ action: 1, status: 1 });

module.exports = mongoose.model("Analytics", analyticsSchema);
