// src/middlewares/authTenant.js
import jwt from "jsonwebtoken";

export const authTenant = (req, res, next) => {
  // 1) Intenta por cookie (HttpOnly) — acepta la cookie real del panel
  const cookieToken = req.cookies?.access_token || req.cookies?.admin_session;

  // 2) Compat: intenta por header Bearer (y x-db-token como fallback)
  const header = req.headers.authorization || req.headers.Authorization || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : header;

  const token = cookieToken || bearer || req.headers["x-db-token"];
  if (!token) return res.status(401).json({ error: "Falta token" });

  try {
    const decoded = jwt.verify(token, process.env.SUPABASE_JWT_SECRET);

    // Acepta restaurantId en camelCase o snake_case
    const rid = decoded.restaurantId ?? decoded.restaurant_id;
    if (!rid) {
      return res.status(403).json({ error: "Token sin restaurantId" });
    }

    // El dbToken del admin se firma con role: "authenticated".
    const rol = decoded.rol || decoded.role || decoded.user_role || "authenticated";
    if (!["admin", "staff", "authenticated"].includes(rol)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }

    req.user = {
      id: decoded.userId || decoded.id,
      restaurantId: rid,
      rol,
      email: decoded.email || decoded.user_email,
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
};
