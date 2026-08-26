const mongoose = require("mongoose");

const panVerificationSchema = new mongoose.Schema(
  {
    verificationId: {
      type: String,
      required: true,
      trim: true,
    },
    pan: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    name: String,
    referenceId: Number,
    type: String,
    nameProvided: String,
    registeredName: String,
    valid: Boolean,
    message: String,
    nameMatchScore: String,
    nameMatchResult: String,
    panStatus: String,
    aadhaarSeedingStatus: String,
    aadhaarSeedingStatusDesc: String,
    lastUpdatedAt: String,
    namePanCard: String,
    fatherName: String,
    rawResponse: mongoose.Schema.Types.Mixed,
    errorMessage: String,
  },
  {
    timestamps: true,
  }
);

panVerificationSchema.index({ verificationId: 1 }, { unique: true });
panVerificationSchema.index({ pan: 1, createdAt: -1 });

module.exports = mongoose.model("PanVerification", panVerificationSchema);
