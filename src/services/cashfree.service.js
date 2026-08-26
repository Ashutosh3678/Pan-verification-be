const axios = require("axios");

const getCashfreeClient = () => {
  const baseURL = process.env.CASHFREE_BASE_URL;
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  const apiVersion = process.env.CASHFREE_API_VERSION || "2023-08-01";

  if (!baseURL || !clientId || !clientSecret) {
    throw new Error(
      "Cashfree credentials are not configured. Check CASHFREE_BASE_URL, CASHFREE_CLIENT_ID, and CASHFREE_CLIENT_SECRET."
    );
  }

  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
      "x-api-version": apiVersion,
    },
    timeout: 30000,
  });
};

const verifyPan = async ({ pan, name }) => {
  const client = getCashfreeClient();
  const payload = { pan };

  if (name) {
    payload.name = name;
  }

  const response = await client.post("/pan", payload);
  return response.data;
};

module.exports = {
  verifyPan,
};
