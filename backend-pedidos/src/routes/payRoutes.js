import { Router } from "express";
import { authAny } from "../middlewares/authAny.js";
import {
  apiCreateCulqiOrder,
  apiCreateCulqiCharge,
  getPublicConfig,
  preparePublicOrder,
  chargePublicToken,
} from "../controllers/payController.js";

const router = Router();

// PRIVADO (tu flujo actual en caja/admin)
router.post("/culqi/order",  authAny, apiCreateCulqiOrder);
router.post("/culqi/charge", authAny, apiCreateCulqiCharge);

// PÚBLICO (BYO keys para el comensal)
router.get ("/public/:restaurantId/config",            getPublicConfig);
router.post("/public/:restaurantId/checkout/prepare",  preparePublicOrder);
router.post("/public/:restaurantId/checkout/charge",   chargePublicToken);

export default router;
