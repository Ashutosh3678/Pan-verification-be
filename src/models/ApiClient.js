const mongoose = require("mongoose");

const apiClientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    apiKey: {
      type: String,
      trim: true,
      default: null,
    },
    clientId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
    },
    clientSecret: {
      type: String,
      required: true,
      trim: true,
    },
    allowedModes: {
      type: [String],
      enum: ["sandbox", "production"],
      default: ["sandbox", "production"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ApiClient", apiClientSchema);
