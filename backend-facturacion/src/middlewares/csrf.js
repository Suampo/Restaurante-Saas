// src/middlewares/csrf.js
// Valida "double submit cookie": header x-csrf-token debe igualar la cookie csrf_token

function requireCsrf(req, res, next) {
  const cookie = req.cookies?.csrf_token;
  const header = req.get("x-csrf-token");
  if (!cookie || !header || cookie !== header) {
    return res.status(403).json({ error: "CSRF inválido" });
  }
  return next();
}

// Exporta con dos nombres para ser compatible con imports anteriores
module.exports = {
  requireCsrf,
  verifyCsrf: requireCsrf,
};
