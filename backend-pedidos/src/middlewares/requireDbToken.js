// src/middlewares/requireDbToken.js
import jwt from "jsonwebtoken";

export function requireDbToken(req, res, next) {
  // admite Authorization: Bearer, x-db-token y cookies httpOnly
  const header = req.headers.authorization || req.headers.Authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;
  const token =
    bearer ||
    req.headers["x-db-token"] ||
    req.cookies?.admin_session ||
    req.cookies?.access_token;

  if (!token) return res.status(401).json({ error: "Falta token" });

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);
    const rid =
      Number(decoded.restaurantId || decoded.restaurant_id) ||
      Number(req.headers["x-restaurant-id"] || req.query.restaurantId || req.body?.restaurantId);

    if (!rid) return res.status(403).json({ error: "Token sin restaurantId" });

    req.user = {
      id: decoded.userId || decoded.sub || decoded.id || null,
      restaurantId: rid,
      rol: decoded.rol || decoded.role || "staff",
    };
    req.tenantId = rid;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}
