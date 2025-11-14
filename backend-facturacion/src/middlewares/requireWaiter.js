// src/middlewares/requireWaiter.js
const jwt = require("jsonwebtoken");

const ALLOWED_ROLES = (process.env.ALLOWED_WAITER_ROLES || "waiter,mozo,staff,admin")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

function safeDecode(token) {
  try {
    const [, payload] = String(token).split(".");
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

module.exports = function requireWaiter(req, res, next) {
  // 1) Toma Bearer
  const auth = req.headers.authorization || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);

  let payload = null;

  if (m) {
    const token = m[1];

    // 2) Verifica el JWT con los secretos disponibles (propios o Supabase)
    const secrets = [
      process.env.JWT_SECRET,
      process.env.JWT_ADMIN_SECRET,
      process.env.SUPABASE_JWT_SECRET, // <- agrega este en .env si tienes Supabase
    ].filter(Boolean);

    for (const secret of secrets) {
      try {
        payload = jwt.verify(token, secret, { algorithms: ["HS256"] });
        break;
      } catch {
        // continúa probando con otros secretos
      }
    }

    // 3) Fallback dev: decodifica sin verificar (sirve para leer claims)
    if (!payload) payload = safeDecode(token);
  }

  // 4) Fallback legacy: si no hubo token, intenta headers antiguos
  if (!payload) {
    const legacyRole = req.get("x-user-role");
    const legacyRid = req.get("x-restaurant-id");
    if (!legacyRole) {
      return res.status(401).json({ ok: false, error: "Missing bearer token" });
    }
    payload = {
      role: legacyRole,
      restaurant_id: legacyRid ? Number(legacyRid) : null,
      sub: null,
      email: null,
    };
  }

  // 5) Normaliza claims
  const role =
    String(
      payload.app_role ||
        payload.user_role ||
        payload.rol ||
        payload.role ||
        ""
    ).toLowerCase() || "authenticated";

  const restaurantId =
    payload.restaurant_id ??
    payload.restaurantId ??
    (req.get("x-restaurant-id") ? Number(req.get("x-restaurant-id")) : null);

  // 6) Política de acceso
  const strict = process.env.REQUIRE_WAITER_STRICT === "1";
  if (strict && !ALLOWED_ROLES.includes(role)) {
    return res.status(403).json({ ok: false, error: "Forbidden: role not allowed", role });
  }

  // 7) Expone usuario en req
  req.user = {
    id: payload.sub || payload.user_id || payload.uid || null,
    email: payload.email || null,
    role,
    restaurantId,
    raw: payload,
  };
  req.sessionRestaurantId = restaurantId;

  // Opcional: logs de depuración
  if (process.env.DEBUG_AUTH === "1") {
    console.log("[requireWaiter] role=%s restaurantId=%s", role, restaurantId);
  }

  return next();
};
