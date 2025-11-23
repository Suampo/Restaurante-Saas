// src/routes/auth.mozo.js
const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Secreto para firmar el JWT del mozo
const JWT_SECRET = process.env.JWT_SECRET || "dev_super_secret_change_me";
const IS_PROD = String(process.env.NODE_ENV).toLowerCase() === "production";

// TODO: Reemplazar por query real a tu BD (staff/mozos por restaurante)
// Aquí sólo validamos un PIN "1234" para el restaurante dado (demo).
async function validateMozo({ restaurantId, pin }) {
  if (!restaurantId || !pin) return null;
  if (String(pin) !== "1234") return null;

  // Retorna el "usuario" mínimo para el token
  return {
    id: "mozo-demo-id",
    email: "mozo@demo.local",
    role: "waiter", // <- importante para requireWaiter
    restaurantId: Number(restaurantId),
    name: "Mozo Demo",
  };
}

/**
 * Helper: setea cookie HttpOnly para el mozo
 */
function setMozoCookie(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "12h" });

  res.cookie("mozo_session", token, {
    httpOnly: true,                 // 🔒 evita acceso desde JS (mitiga XSS)
    sameSite: "lax",                // 🔒 ayuda contra CSRF básico
    secure: IS_PROD,                // sólo por HTTPS en producción
    path: "/",                      // toda la app en :5000
    maxAge: 1000 * 60 * 60 * 12,    // 12 horas
  });

  return token;
}

// POST /api/auth/login-mozo  { restaurantId, pin }
router.post("/api/auth/login-mozo", async (req, res) => {
  try {
    const { restaurantId, pin } = req.body || {};
    const user = await validateMozo({ restaurantId, pin });
    if (!user) {
      return res
        .status(401)
        .json({ ok: false, error: "Credenciales inválidas" });
    }

    // payload mínimo para el JWT
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      restaurantId: user.restaurantId,
      name: user.name,
    };

    // 👉 Setea cookie HttpOnly
    const token = setMozoCookie(res, payload);

    // opcional: también devolvemos el token por compatibilidad
    res.json({ ok: true, token, user });
  } catch (e) {
    console.error("login-mozo:", e);
    res.status(500).json({ ok: false, error: "Error en login-mozo" });
  }
});

/**
 * POST /api/auth/logout-mozo
 * Borra la cookie HttpOnly del mozo
 */
router.post("/api/auth/logout-mozo", (req, res) => {
  res.clearCookie("mozo_session", {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,
    path: "/",
  });
  return res.json({ ok: true });
});

module.exports = router;
