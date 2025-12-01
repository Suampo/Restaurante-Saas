// backend-pedidos/src/routes/sessionRoutes.js
import { Router } from "express";
import crypto from "crypto";
import {
  setSessionFromToken,
  validateCookie,
  logout,
  sessionState,
  refreshFromCookie,
} from "../controllers/sessionController.js";

const router = Router();

const IS_PROD =
  String(process.env.NODE_ENV || "development").toLowerCase() === "production";

/**
 * GET /api/health
 */
router.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * GET /api/csrf
 *
 * - Asegura que exista la cookie csrf_token (no httpOnly, sameSite=lax, path=/api)
 * - Devuelve el mismo token en el JSON: { csrfToken }
 *
 * Esto es lo que el frontend usa para el header x-csrf-token
 */
router.get("/csrf", (req, res) => {
  let token = (req.cookies?.csrf_token || "").trim();

  // Si aún no existe cookie en este request, generamos una nueva
  if (!token) {
    token = crypto.randomBytes(24).toString("hex");
  }

  // Siempre reescribimos la cookie para garantizar coherencia
  res.cookie("csrf_token", token, {
    httpOnly: false,      // accesible desde JS
    sameSite: "lax",
    secure: IS_PROD,
    path: "/api",         // importante: coincide con tus rutas /api/*
    maxAge: 1000 * 60 * 60 * 12, // 12 horas
  });

  return res.status(200).json({ csrfToken: token });
});

/**
 * POST /api/session/refresh
 * - Usa cookie httpOnly (firmada con ADMIN_SECRET)
 * - Emite un dbToken (RLS) con restaurantId/email (1h)
 */
router.post("/session/refresh", refreshFromCookie);

/**
 * POST /api/auth/session
 * - Crea cookie httpOnly desde un token (admin o dbToken)
 */
router.post("/auth/session", setSessionFromToken);

/**
 * GET /api/auth/validate-cookie
 * - 204 si cookie válida; 401 si no
 */
router.get("/auth/validate-cookie", validateCookie);

/**
 * GET /api/auth/session-state
 * - Estado simple (siempre 200)
 */
router.get("/auth/session-state", sessionState);

/**
 * POST /api/auth/logout
 * - Borra la cookie httpOnly
 */
router.post("/auth/logout", logout);

export default router;
