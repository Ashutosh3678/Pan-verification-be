const multer = require("multer");

/**
 * Strict in-memory storage configuration.
 * NO file is ever written to disk or saved permanently.
 * Files are held as transient Buffer objects in RAM only for the duration of the API call.
 */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum allowed by Cashfree
  },
  fileFilter: (_req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf";
    const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");

    if (isPdfMime || isPdfExt) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file format. Only PDF documents (.pdf) are allowed."), false);
    }
  },
});

const uploadImage = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum limit
  },
  fileFilter: (_req, file, cb) => {
    const validMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "application/octet-stream", // in case sent via generic binary multipart
    ];
    const ext = file.originalname.toLowerCase();
    const validExts = [".jpg", ".jpeg", ".png"];

    const isValidMime = validMimes.includes(file.mimetype);
    const isValidExt = validExts.some((e) => ext.endsWith(e));

    if (isValidMime || isValidExt) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid image format. Supported formats are JPEG, JPG, and PNG."),
        false
      );
    }
  },
});

upload.image = uploadImage;
upload.uploadImage = uploadImage;

module.exports = upload;

