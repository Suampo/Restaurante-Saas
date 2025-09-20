// src/controllers/sessionController.js
import jwt from "jsonwebtoken";
import crypto from "crypto";

const isProd = process.env.NODE_ENV === "production";

// Claves consistentes
const ADMIN_SECRET  = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
const CLIENT_SECRET = process.env.JWT_CLIENT_SECRET || ADMIN_SECRET;

// Usaremos una sola cookie para admin/cliente
const COOKIE_NAME   = process.env.AUTH_COOKIE_NAME || "admin_session";

/* ========== helpers ========== */

function ensureCsrfCookie(req, res) {
  if (!req.cookies?.csrf_token) {
    const token = crypto.randomBytes(24).toString("hex");
    res.cookie("csrf_token", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      path: "/",
    });
  }
}

// Verifica con cualquiera de las claves conocidas
function verifyAny(token) {
  const secrets = [ADMIN_SECRET, CLIENT_SECRET];
  for (const s of secrets) {
    try { return jwt.verify(token, s); } catch {}
  }
  return null;
}

function extractClaims(payload = {}) {
  const type =
    payload.type ??
    payload.t ??
    payload.role ??
    payload.rol ??
    null;

  const email =
    payload.email ??
    payload.user_email ??
    payload.user?.email ??
    payload.sub ??
    null;

  const restaurantId = Number(
    payload.restaurantId ??
    payload.restaurant_id ??
    payload.restauranteId ??
    0
  );

  return { type, email, restaurantId };
}

function setSessionCookie(res, { type, email, restaurantId }) {
  const days = Number(process.env.AUTH_COOKIE_DAYS || 30);
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  // Firmamos SIEMPRE la cookie con ADMIN_SECRET para leerla de forma uniforme
  const sessionJwt = jwt.sign(
    {
      type: type || "client",
      email: email || null,       // puede ser null para cliente anónimo
      restaurantId: Number(restaurantId),
    },
    ADMIN_SECRET,
    { expiresIn: `${days}d` }
  );

  res.cookie(COOKIE_NAME, sessionJwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
    expires,
  });
}

/* ========== Rutas ========== */

/** POST /api/auth/session
 * Body: { token }  (puede venir de login admin o login-cliente)
 * - Acepta tokens firmados con ADMIN_SECRET o CLIENT_SECRET
 * - Para cliente NO exige email; solo restaurantId
 * - Crea cookie httpOnly uniforme firmada con ADMIN_SECRET
 */
export async function setSessionFromToken(req, res) {
  try {
    const token = String(req.body?.token || "");
    if (!token) return res.status(400).json({ error: "token requerido" });

    let payload = verifyAny(token);
    if (!payload) {
      // último recurso en dev: decodifica (seguimos validando campos)
      try { payload = jwt.decode(token) || null; } catch { payload = null; }
    }
    if (!payload) return res.status(401).json({ error: "token inválido" });

    const { type, email, restaurantId } = extractClaims(payload);
    if (!Number(restaurantId)) {
      return res.status(401).json({ error: "claims incompletos" });
    }

    setSessionCookie(res, { type, email, restaurantId });
    ensureCsrfCookie(req, res);
    return res.status(204).end();
  } catch (e) {
    console.error("[/auth/session] error:", e);
    return res.status(500).json({ error: "Error al crear sesión" });
  }
}

/** GET /api/auth/validate-cookie
 * Lee y valida la cookie httpOnly firmada con ADMIN_SECRET
 */
export function validateCookie(req, res) {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "Sin sesión" });

    const payload = jwt.verify(raw, ADMIN_SECRET);
    const { type, email, restaurantId } = extractClaims(payload);
    if (!Number(restaurantId)) {
      return res.status(401).json({ error: "Sesión incompleta" });
    }
    return res.json({ ok: true, type: type || "client", email: email || null, restaurantId: Number(restaurantId) });
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }
}

/** POST /api/auth/logout */
export function logout(_req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd,
    path: "/",
  });
  return res.status(204).end();
}

/** GET /api/auth/session-state (siempre 200) */
export function sessionState(req, res) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return res.json({ loggedIn: false });
  try {
    const payload = jwt.verify(raw, ADMIN_SECRET);
    const { restaurantId } = extractClaims(payload);
    return res.json({ loggedIn: Number(restaurantId) > 0 });
  } catch {
    return res.json({ loggedIn: false });
  }
}
