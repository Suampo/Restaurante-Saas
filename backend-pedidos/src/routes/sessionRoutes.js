// src/routes/sessionRoutes.js
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

router.get("/health", (_req, res) => res.json({ ok: true }));

// ✅ NUEVO: /api/csrf devuelve el token y lo setea en cookie
router.get("/csrf", (_req, res) => {
  const token = crypto.randomBytes(24).toString("hex");

  // misma config que tu middleware global, pero aquí controlado
  res.cookie("csrf_token", token, {
    httpOnly: false,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/api",
    maxAge: 1000 * 60 * 60 * 12, // 12h
  });

  return res.json({ csrfToken: token });
});

// Refresca dbToken desde cookie httpOnly
router.post("/session/refresh", refreshFromCookie);

// Crea cookie httpOnly desde un token (admin o dbToken)
router.post("/auth/session", setSessionFromToken);

// Valida cookie httpOnly
router.get("/auth/validate-cookie", validateCookie);

// Estado
router.get("/auth/session-state", sessionState);

// Logout
router.post("/auth/logout", logout);

export default router;
