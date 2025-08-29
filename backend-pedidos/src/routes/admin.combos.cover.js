import express from "express";
import multer from "multer";
import { authTenant } from "../middlewares/authTenant.js";
import { uploadComboCover } from "../controllers/comboImageController.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

// field name: image
router.post("/admin/combos/:id/cover", authTenant, upload.single("image"), uploadComboCover);

export default router;
