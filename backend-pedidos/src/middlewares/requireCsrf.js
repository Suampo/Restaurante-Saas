// src/middlewares/requireCsrf.js
const SAFE = ["GET", "HEAD", "OPTIONS"];

const BYPASS_PREFIX = [
  "/api/session/login",
  "/api/session/refresh",
  "/api/csrf",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/login",
  "/api/auth/login-cliente",
  "/api/webhooks",
];

export function requireCsrf(req, res, next) {
  const method = (req.method || "GET").toUpperCase();
  if (SAFE.includes(method)) return next();

  // 1) Rutas que siempre saltan CSRF
  if (BYPASS_PREFIX.some((p) => (req.path || "").startsWith(p))) return next();

  // 2) Si viene autenticación (Bearer o x-db-token) o cookie admin, saltamos CSRF
  const hasAuthHeader =
    !!req.headers.authorization ||
    !!req.headers.Authorization ||
    !!req.headers["x-db-token"];
  const hasAdminCookie = !!req.cookies?.admin_session;

  if (hasAuthHeader || hasAdminCookie) return next();

  // 3) Público: exigir CSRF (cookie + header/body)
  const cookieToken = (req.cookies?.csrf_token || "").trim();
  const headerToken =
    (req.get("x-csrf-token") ||
      req.get("X-CSRF-Token") ||
      req.get("X-XSRF-Token") ||
      "").trim();
  const bodyToken = (req.body?._csrf || req.query?._csrf || "").trim();

  const sent = headerToken || bodyToken;
  if (!cookieToken || !sent || cookieToken !== sent) {
    return res.status(403).json({ error: "CSRF inválido" });
  }
  return next();
}
