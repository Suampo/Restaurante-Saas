// src/middlewares/requireAuthCookie.js
import jwt from "jsonwebtoken";

const ADMIN_SECRET = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
const COOKIE_NAME  = process.env.AUTH_COOKIE_NAME || "admin_session";

export function requireAuthCookie(req, res, next) {
  try {
    const raw = req.cookies?.[COOKIE_NAME];
    if (!raw) return res.status(401).json({ error: "No autenticado" });

    const payload = jwt.verify(raw, ADMIN_SECRET);
    const restaurantId =
      Number(payload?.restaurantId ?? payload?.restaurant_id ?? 0);

    if (!restaurantId) {
      return res.status(401).json({ error: "Sesión incompleta" });
    }

    req.user = payload;
    req.restaurantId = restaurantId;
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido/expirado" });
  }
}
