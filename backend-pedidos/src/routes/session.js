// src/routes/session.js
import { Router } from "express";
import bcrypt from "bcryptjs";
import { supabase as admin } from "../config/supabase.js";
import { signDbToken } from "../auth/signDbToken.js";

const router = Router();

/**
 * POST /api/session/login
 * body: { email, password }
 * resp: { dbToken, restaurantId, role, userId, email }
 */
router.post("/session/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    // Busca usuario por email (case-insensitive)
    const { data: user, error } = await admin
      .from("usuarios")
      .select("id, email, password_hash, restaurant_id, rol")
      .ilike("email", email)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }

    // Verifica contraseña con bcrypt
    const ok = user.password_hash
      ? await bcrypt.compare(password, user.password_hash)
      : false;
    if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

    // Permitir admin/owner/staff (el front decidirá acceso a vistas)
    const role = String(user.rol || "").toLowerCase();
    const allowed = ["admin", "owner", "staff"];
    if (!allowed.includes(role)) {
      return res.status(403).json({ error: "Rol no autorizado" });
    }

    // Firma token con claims útiles para el front
    const dbToken = await signDbToken({
      email: user.email,
      restaurantId: user.restaurant_id,
      role,
      userId: String(user.id),
      ttlSec: 3600, // 1h
    });

    return res.json({
      dbToken,
      restaurantId: user.restaurant_id,
      role,
      userId: String(user.id),
      email: user.email,
    });
  } catch (e) {
    console.error("[/session/login] error:", e);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

export default router;
