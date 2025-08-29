// src/routes/checkoutRoutes.js
import { Router } from "express";
import { apiCheckoutPrepare } from "../controllers/checkoutController.js";

const router = Router();

// Ruta pública: la usa el landing (no requiere JWT)
router.post("/prepare", apiCheckoutPrepare);

export default router;
