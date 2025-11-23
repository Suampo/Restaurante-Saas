// src/middlewares/multer.js
import multer from "multer";

const storage = multer.memoryStorage();

// Tipos permitidos a nivel de cabecera. La verificación fuerte se hace en los controllers.
const mimeAllow = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const fileFilter = (req, file, cb) => {
  if (!mimeAllow.includes(file.mimetype)) {
    return cb(new Error("Tipo MIME no permitido"), false);
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});
