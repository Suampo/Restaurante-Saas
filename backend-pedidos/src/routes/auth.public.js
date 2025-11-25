// routes/auth.public.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

const IS_PROD =
  String(process.env.NODE_ENV || "development").toLowerCase() === "production";

// 🔐 Secreto SOLO para clientes
const CLIENT_SECRET =
  process.env.JWT_CLIENT_SECRET ||
  (!IS_PROD ? "dev_client_secret" : null);

if (IS_PROD && !process.env.JWT_CLIENT_SECRET) {
  throw new Error(
    "JWT_CLIENT_SECRET requerido en producción (tokens de cliente)"
  );
}

/**
 * POST /api/auth/login-cliente
 * body: { restaurantId:number }
 * resp: { token, expiresIn }
 *
 * - Emite un JWT de cliente (rol=client) con duración corta (2h).
 * - Pensado para que el frontend-cliente lo guarde en memoria/sessionStorage
 *   y lo mande por Authorization: Bearer <token>.
 */
router.post("/auth/login-cliente", (req, res) => {
  try {
    const restaurantId = Number(req.body?.restaurantId || 0);
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId inválido" });
    }

    const expiresSeconds = 2 * 60 * 60; // 2 horas

    const token = jwt.sign(
      {
        type: "client",
        rol: "client",
        restaurantId,
      },
      CLIENT_SECRET,
      { expiresIn: expiresSeconds }
    );

    return res.json({ token, expiresIn: expiresSeconds });
  } catch (err) {
    console.error("POST /api/auth/login-cliente", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
