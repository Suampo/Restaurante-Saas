// src/middlewares/requireCsrf.js
const SAFE = ["GET", "HEAD", "OPTIONS"];

// Añadimos las rutas reales que no deben exigir CSRF al inicio de sesión / refresh.
const BYPASS_PREFIX = [
  "/api/auth/login",
  "/api/auth/session",
  "/api/auth/logout",
  "/api/auth/login-cliente",
  "/api/session/login",     // 👈 añade esto
  "/api/session/refresh",   // 👈 y esto
  "/api/csrf",              // para sembrar CSRF
  "/api/webhooks",          // webhooks externos
];

export function requireCsrf(req, res, next) {
  // Métodos "seguros" no requieren token
  const method = (req.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  // cookie sembrada en server.js
  const cookieToken = (req.cookies?.csrf_token || "").trim();

  // header que mandamos desde el front
  const headerToken =
    (req.get("X-CSRF-Token") || req.get("x-csrf-token") || req.get("X-XSRF-Token") || "").trim();

  // fallback por si lo pasan en body/query (no recomendado)
  const bodyToken = (req.body?._csrf || req.query?._csrf || "").trim();

  const sent = headerToken || bodyToken;

  if (!cookieToken || !sent || cookieToken !== sent) {
    return res.status(403).json({ error: "CSRF inválido" });
  }
  return next();
}