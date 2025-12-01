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

// src/routes/sessionRoutes.js

// Forzar/sembrar CSRF si falta y devolver el token al frontend
router.get("/csrf", (req, res) => {
  const token =
    req.csrf_token_seeded || // lo puso el middleware de server.js
    (req.cookies && req.cookies.csrf_token) ||
    null;

  if (!token) {
    return res.status(500).json({ error: "CSRF no inicializado" });
  }

  // La cookie ya fue seteada por el middleware global.
  // Aquí SOLO devolvemos el valor para que el frontend lo mande en x-csrf-token.
  res.json({ csrfToken: token });
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
