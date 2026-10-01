require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const panRoutes = require("./routes/pan.routes");
const aadhaarRoutes = require("./routes/aadhaar.routes");
const oneinfoRoutes = require("./routes/oneinfo.routes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ success: true, message: "OneInfo Verification Gateway is running" });
});

app.use("/api/oneinfo", oneinfoRoutes);
app.use("/api/pan", panRoutes);
app.use("/api/aadhaar", aadhaarRoutes);



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
