// src/routes/authRoutes.js
import { Router } from "express";
import {
  login,
  loginCliente,
  me,
  generarTokenTemporal,
  validateToken,
  generarTokenServicio,
} from "../controllers/authController.js";
import { authAny } from "../middlewares/authAny.js";

const router = Router();

// ===== Rutas existentes (compat) =====
router.post("/login", login);
router.post("/login-cliente", loginCliente);
router.post("/token-temporal", generarTokenTemporal);
router.get("/me", authAny, me);
router.post("/generar-token-servicio", generarTokenServicio);

// Validación por header (compat)
router.get("/validate-token", authAny, validateToken);

// Si quisieras validar por cookie desde aquí, podrías re-usar requireAuthCookie:
// router.get("/validate-token", requireAuthCookie, validateCookie);

export default router;
