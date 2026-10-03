const cashfreeService = require("../services/cashfree.service");

/**
 * Pure in-memory GSTIN verification - NO data stored in DB or disk
 */
const verifyGstin = async (req, res) => {
  const environment = req.environment || "sandbox";
  const gstin = req.gstin || req.body.gstin || req.body.GSTIN;
  const businessName = req.body.businessName || req.body.business_name;
  const verificationId =
    req.verificationId ||
    req.body.verificationId ||
    req.body.verification_id ||
    `gstin_${Date.now()}`;

  try {
    const providerResponse = await cashfreeService.verifyGstin({
      gstin,
      businessName,
      environment,
    });

    return res.status(200).json({
      success: true,
      environment,
      data: {
        verificationId,
        referenceId: providerResponse.reference_id,
        gstin: providerResponse.GSTIN,
        legalNameOfBusiness: providerResponse.legal_name_of_business,
        tradeNameOfBusiness: providerResponse.trade_name_of_business,
        centerJurisdiction: providerResponse.center_jurisdiction,
        stateJurisdiction: providerResponse.state_jurisdiction,
        dateOfRegistration: providerResponse.date_of_registration,
        constitutionOfBusiness: providerResponse.constitution_of_business,
        taxpayerType: providerResponse.taxpayer_type,
        gstInStatus: providerResponse.gst_in_status,
        lastUpdateDate: providerResponse.last_update_date,
        natureOfBusinessActivities:
          providerResponse.nature_of_business_activities || [],
        principalPlaceAddress: providerResponse.principal_place_address,
        principalPlaceSplitAddress: providerResponse.principal_place_split_address
          ? {
              buildingName:
                providerResponse.principal_place_split_address.building_name,
              street: providerResponse.principal_place_split_address.street,
              location: providerResponse.principal_place_split_address.location,
              buildingNumber:
                providerResponse.principal_place_split_address.building_number,
              district: providerResponse.principal_place_split_address.district,
              state: providerResponse.principal_place_split_address.state,
              city: providerResponse.principal_place_split_address.city,
              flatNumber:
                providerResponse.principal_place_split_address.flat_number,
              latitude: providerResponse.principal_place_split_address.latitude,
              longitude:
                providerResponse.principal_place_split_address.longitude,
              pincode: providerResponse.principal_place_split_address.pincode,
            }
          : null,
        additionalAddressArray: (
          providerResponse.additional_address_array || []
        ).map((item) => ({
          address: item.address,
          splitAddress: item.split_address
            ? {
                buildingName: item.split_address.building_name,
                street: item.split_address.street,
                location: item.split_address.location,
                buildingNumber: item.split_address.building_number,
                district: item.split_address.district,
                state: item.split_address.state,
                city: item.split_address.city,
                flatNumber: item.split_address.flat_number,
                latitude: item.split_address.latitude,
                longitude: item.split_address.longitude,
                pincode: item.split_address.pincode,
              }
            : null,
        })),
        valid: providerResponse.valid,
        message: providerResponse.message,
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
      message: "GSTIN verification failed",
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
  verifyGstin,
  getVerificationHistory,
  getVerificationById,
};
