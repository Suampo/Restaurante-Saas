// src/controllers/sessionController.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { signDbToken } from "../auth/signDbToken.js";

const DB_SECRET    = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET   || DB_SECRET;
const COOKIE_NAME  = process.env.AUTH_COOKIE_NAME   || "admin_session";
const IS_PROD      = String(process.env.NODE_ENV).toLowerCase() === "production";

function extractClaims(payload) {
  const restaurantId = Number(payload?.restaurantId ?? payload?.restaurant_id ?? 0);
  const email = payload?.email || payload?.sub || null;
  const type = payload?.type || "admin";
  return { restaurantId, email, type };
}

function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, ADMIN_SECRET, { expiresIn: "7d" });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD, // en dev, false para http://localhost
    path: "/",
    // domain: (opcional) si usas un dominio específico
  });
}

function ensureCsrfCookie(req, res) {
  const exists = req.cookies?.csrf_token;
  if (!exists) {
    const v = crypto.randomBytes(16).toString("hex");
    res.cookie("csrf_token", v, {
      httpOnly: false,
      sameSite: "lax",
      secure: IS_PROD,
      path: "/",
    });
  }
}

/** Verifica con cualquiera de los secretos admitidos */
function verifyAny(token) {
  const secrets = [ADMIN_SECRET, DB_SECRET];
  for (const s of secrets) {
    try {
      return jwt.verify(token, s);
    } catch {}
  }
  return null;
}

/**
 * POST /api/auth/session
 * Body: { token }
 * - Acepta un JWT válido (dbToken o admin token)
 * - Verifica firmando (SIN decode libre)
 * - Si ok -> siembra cookie httpOnly (admin_session)
 */
export async function setSessionFromToken(req, res) {
  try {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "token requerido" });

    const payload = verifyAny(token);
    if (!payload) return res.status(401).json({ error: "token inválido" });

    const { restaurantId, email, type } = extractClaims(payload);
    if (!restaurantId) return res.status(401).json({ error: "claims incompletos" });

    // cookie con claims mínimos
    setSessionCookie(res, { restaurantId, email, type: type || "admin" });
    ensureCsrfCookie(req, res);
    return res.status(204).end();
  } catch (e) {
    console.error("[/auth/session] error:", e);
    return res.status(500).json({ error: "Error al crear sesión" });
  }
}

/**
 * GET /api/auth/validate-cookie
 * - 204 si cookie válida; 401 si no
 */
export function validateCookie(req, res) {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "Sin cookie" });
    jwt.verify(raw, ADMIN_SECRET);
    return res.status(204).end();
  } catch {
    return res.status(401).json({ error: "Cookie inválida" });
  }
}

/**
 * GET /api/auth/session-state
 * - Estado simple (siempre 200)
 */
export function sessionState(req, res) {
  const has = !!req.cookies?.[COOKIE_NAME];
  res.json({ hasCookie: has, cookieName: COOKIE_NAME });
}

/**
 * POST /api/auth/logout
 * - Borra la cookie httpOnly
 */
export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
  });
  return res.status(204).end();
}

/**
 * POST /api/session/refresh
 * - Usa cookie httpOnly (firmada con ADMIN_SECRET)
 * - Emite un dbToken (RLS) con restaurantId/email (1h)
 */
export async function refreshFromCookie(req, res) {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "Sin sesión" });

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

    const email = payload?.email || payload?.sub || `anon+${restaurantId}@client.local`;

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
}
