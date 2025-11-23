// src/routes/menuImageRoutes.js
import { Router } from "express";
import { upload } from "../middlewares/multer.js";
import { uploadMenuImage } from "../controllers/menuImageController.js";
import { authTenant } from "../middlewares/authTenant.js";

const router = Router();

// campo form-data: "image"
router.post(
  "/:id/upload-image",
  authTenant,
  upload.single("image"),
  uploadMenuImage
);

export default router;
