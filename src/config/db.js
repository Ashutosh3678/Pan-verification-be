require("dotenv").config();

const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/oneinfo_db";

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.warn(
      `[Notice] MongoDB connection skipped (${error.message}). Gateway is operating with .env credentials in pure in-memory mode.`
    );
  }
};

module.exports = connectDB;
