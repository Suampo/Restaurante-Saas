// routes/auth.public.js
import express from "express";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * POST /api/auth/login-cliente
 * body: { restaurantId:number }
 * devuelve: { token }
 */
router.post("/auth/login-cliente", (req, res) => {
  try {
    const restaurantId = Number(req.body?.restaurantId || 0);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId inválido" });

    const token = jwt.sign(
      { role: "client", restaurantId },
      process.env.SUPABASE_JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({ token });
  } catch (err) {
    console.error("POST /auth/login-cliente", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
