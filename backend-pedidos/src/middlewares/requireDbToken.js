// src/middlewares/requireDbToken.js
import jwt from "jsonwebtoken";

const DB_SECRET    = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
const ADMIN_SECRET = process.env.JWT_ADMIN_SECRET   || DB_SECRET;
const COOKIE_NAME  = process.env.AUTH_COOKIE_NAME   || "admin_session";

/**
 * Prioridad:
 *   1. Authorization: Bearer <dbToken> o x-db-token (HS256 con SUPABASE_JWT_SECRET)
 *   2. Cookie httpOnly admin_session (HS256 con ADMIN_SECRET/DB_SECRET)
 */
export function requireDbToken(req, res, next) {
  // 1) Header
  const header = req.headers.authorization || req.headers.Authorization || "";
  const bearer = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7)
    : header;
  const tokenHeader = bearer || req.headers["x-db-token"];

  // 2) Cookie (respaldo)
  const tokenCookie = req.cookies?.[COOKIE_NAME];

  if (!tokenHeader && !tokenCookie) {
    return res.status(401).json({ error: "Falta token" });
  }

  // Verifica header (dbToken)
  if (tokenHeader) {
    try {
      const decoded = jwt.verify(tokenHeader, DB_SECRET);

      const rid =
        Number(decoded.restaurantId ?? decoded.restaurant_id) ||
        Number(req.headers["x-restaurant-id"] || req.query.restaurantId || req.body?.restaurantId);

      if (!rid) return res.status(403).json({ error: "Token sin restaurantId" });

      req.user = {
        id: decoded.userId || decoded.sub || null,
        email: decoded.email || null,
        restaurantId: rid,
        role: decoded.rol || decoded.role || decoded.user_role || "authenticated",
      };
      req.restaurantId = rid;
      return next();
    } catch (e) {
      // seguimos con cookie como fallback
    }
  }

  // Verifica cookie (admin_session)
  if (tokenCookie) {
    try {
      const decoded = jwt.verify(tokenCookie, ADMIN_SECRET);

      const rid =
        Number(decoded.restaurantId ?? decoded.restaurant_id) ||
        Number(req.headers["x-restaurant-id"] || req.query.restaurantId || req.body?.restaurantId);

      if (!rid) return res.status(403).json({ error: "Cookie sin restaurantId" });

      req.user = {
        id: decoded.userId || decoded.sub || null,
        email: decoded.email || null,
        restaurantId: rid,
        role: decoded.rol || decoded.role || "admin",
      };
      req.restaurantId = rid;
      return next();
    } catch (_e) {
      return res.status(401).json({ error: "Token inválido/expirado" });
    }
  }

  return res.status(401).json({ error: "No autorizado" });
}

export default requireDbToken;
