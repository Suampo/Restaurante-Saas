// src/middlewares/csrf.js
// Valida "double submit cookie": header x-csrf-token debe igualar la cookie csrf_token
// ✅ Solo para métodos que modifican estado (POST, PUT, PATCH, DELETE)
// ❌ Se omite CSRF para /api/split (ya va protegido con JWT + x-restaurant-id)

function isSplitRoute(req) {
  const u = (req.originalUrl || req.url || "").toLowerCase();
  return u.startsWith("/api/split") || u.includes("/api/split/");
}

function requireCsrf(req, res, next) {
  const method = (req.method || "").toUpperCase();

  // 1) No aplicar CSRF a métodos seguros
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return next();
  }

  // 2) No aplicar CSRF a /api/split (split/efectivo) → se protege solo con JWT
  if (isSplitRoute(req)) {
    return next();
  }

  const cookie = req.cookies?.csrf_token;
  const header = req.get("x-csrf-token");

  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ error: "CSRF inválido" });
  }

  return next();
}

// Exporta con dos nombres para compatibilidad
module.exports = {
  requireCsrf,
  verifyCsrf: requireCsrf,
};
