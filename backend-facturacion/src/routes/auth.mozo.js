// src/routes/auth.mozo.js
const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "dev_super_secret_change_me";

// TODO: Reemplazar por query real a tu BD (staff/mozos por restaurante)
// Aquí sólo validamos un PIN "1234" para el restaurante dado (demo).
async function validateMozo({ restaurantId, pin }) {
  // Ejemplo rápido: acepta PIN "1234"
  if (!restaurantId || !pin) return null;
  if (String(pin) !== "1234") return null;

  // Retorna el "usuario" mínimo para el token
  return {
    id: "mozo-demo-id",
    email: "mozo@demo.local",
    role: "waiter",                  // <- importante para requireWaiter
    restaurantId: Number(restaurantId),
    name: "Mozo Demo",
  };
}

// POST /api/auth/login-mozo  { restaurantId, pin }
router.post("/api/auth/login-mozo", async (req, res) => {
  try {
    const { restaurantId, pin } = req.body || {};
    const user = await validateMozo({ restaurantId, pin });
    if (!user) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        restaurantId: user.restaurantId,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    // Devuelve el token para que el front lo guarde en localStorage
    res.json({ ok: true, token, user });
  } catch (e) {
    console.error("login-mozo:", e);
    res.status(500).json({ ok: false, error: "Error en login-mozo" });
  }
});

module.exports = router;
