// src/routes/sessionRoutes.js
import { Router } from "express";
import jwt from "jsonwebtoken";
import { signDbToken } from "../auth/signDbToken.js";
import {
  setSessionFromToken,
  validateCookie,
  logout,
  sessionState,
} from "../controllers/sessionController.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

// Forzar CSRF (tu server ya siembra si falta; esto es por compat)
router.get("/csrf", (_req, res) => res.status(204).end());

/**
 * POST /api/session/refresh
 * - Lee cookie httpOnly (firmada con ADMIN_SECRET)
 * - Emite un dbToken (RLS) con restaurantId y email (si existe)
 */
router.post("/session/refresh", async (req, res) => {
  try {
    const cookieName = process.env.AUTH_COOKIE_NAME || "admin_session";
    const raw = req.cookies?.[cookieName];
    if (!raw) return res.status(401).json({ error: "Sin sesión" });

    const ADMIN_SECRET = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
    let payload;
    try {
      payload = jwt.verify(raw, ADMIN_SECRET);
    } catch {
      return res.status(401).json({ error: "Sesión inválida" });
    }

    const restaurantId = Number(
      payload?.restaurantId ?? payload?.restaurant_id ?? 0
    );
    if (!restaurantId) {
      return res.status(401).json({ error: "Sesión incompleta" });
    }

    // email puede no existir para cliente anónimo → ponemos uno sintético
    const email =
      payload?.email ||
      payload?.user?.email ||
      `anon+${restaurantId}@client.local`;

    // 1 hora por defecto
    const dbToken = await signDbToken({
      email,
      restaurantId,
      ttlSec: 3600,
    });

    return res.json({ dbToken });
  } catch (e) {
    console.error("[/session/refresh] error:", e);
    return res.status(500).json({ error: "Error al refrescar sesión" });
  }
});

// Crea cookie httpOnly desde un token (admin o cliente)
router.post("/auth/session", setSessionFromToken);

// Valida cookie httpOnly
router.get("/auth/validate-cookie", validateCookie);

// Estado (siempre 200)
router.get("/auth/session-state", sessionState);

// Logout
router.post("/auth/logout", logout);

export default router;
