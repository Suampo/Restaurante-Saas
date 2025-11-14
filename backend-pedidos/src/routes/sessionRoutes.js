// src/routes/sessionRoutes.js
import { Router } from "express";
import {
  setSessionFromToken,
  validateCookie,
  logout,
  sessionState,
  refreshFromCookie,
} from "../controllers/sessionController.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

// Forzar/sembrar CSRF si falta (compat)
router.get("/csrf", (_req, res) => res.status(204).end());

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
