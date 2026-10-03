require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const panRoutes = require("./routes/pan.routes");
const aadhaarRoutes = require("./routes/aadhaar.routes");
const esignRoutes = require("./routes/esign.routes");
const faceRoutes = require("./routes/face.routes");
const gstinRoutes = require("./routes/gstin.routes");
const mobile360Routes = require("./routes/mobile360.routes");
const oneinfoRoutes = require("./routes/oneinfo.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "OneInfo Verification Gateway is running" });
});

const oneinfoController = require("./controllers/oneinfo.controller");

app.use("/api", oneinfoRoutes);
app.use("/api/oneinfo", oneinfoRoutes);
app.use("/api/pan", panRoutes);
app.use("/api/aadhaar", aadhaarRoutes);
app.use("/api/esign", esignRoutes);
app.use("/api/face", faceRoutes);
app.use("/api/gstin", gstinRoutes);
app.use("/api/mobile360", mobile360Routes);

// White-labeled E-Sign Redirection & Download Gateway
app.get("/esign", oneinfoController.handleEsignRedirect);
app.get("/esign/download/:verificationId", oneinfoController.downloadSignedDocument);

// White-labeled DigiLocker Redirection Gateway
app.get("/dgl", oneinfoController.handleDigilockerRedirect);
app.get("/digilocker", oneinfoController.handleDigilockerRedirect);



const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();

module.exports = app;
