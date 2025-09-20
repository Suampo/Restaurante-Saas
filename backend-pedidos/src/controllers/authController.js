// src/controllers/authController.js
import { pool } from "../config/db.js";
import jwt from "jsonwebtoken";

const ADMIN_SECRET  = process.env.SUPABASE_JWT_SECRET || "dev_admin_secret";
const CLIENT_SECRET = process.env.JWT_CLIENT_SECRET || ADMIN_SECRET;

// --- Login ADMIN (email + password) ---
export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const result = await pool.query(
      `SELECT id, restaurant_id, nombre, email, rol
         FROM usuarios
        WHERE lower(email) = $1 AND password = $2
        LIMIT 1`,
      [email, password] // ⚠️ en producción usa hash (bcrypt)
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const u = result.rows[0];

    const token = jwt.sign(
      { userId: u.id, restaurantId: u.restaurant_id, rol: u.rol || "admin" },
      ADMIN_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      user: {
        id: u.id,
        restaurantId: u.restaurant_id,
        nombre: u.nombre,
        email: u.email,
        rol: u.rol || "admin",
      },
    });
  } catch (error) {
    console.error("login:", error.message);
    res.status(500).json({ error: "Error en el servidor" });
  }
};

// --- Login CLIENTE (solo restaurantId) ---
export const loginCliente = (req, res) => {
  const restaurantId = Number(req.body?.restaurantId || 0);
  if (!restaurantId) return res.status(400).json({ error: "Falta restaurantId" });

  const token = jwt.sign(
    {
      type: "client",           // ⬅️ clave para diferenciar en la cookie
      rol: "client",
      restaurantId,
      // email opcional; si no lo pones, igual funciona
    },
    CLIENT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
};

// --- POST /api/auth/token-temporal (nuevo) ---
export const generarTokenTemporal = (req, res) => {
  const { restaurantId, mesaId } = req.body;

  if (!restaurantId || !mesaId) {
    return res.status(400).json({ error: "Faltan restaurantId o mesaId" });
  }

  const token = jwt.sign(
    { restaurantId, mesaId, rol: "client" },
    process.env.JWT_CLIENT_SECRET || "dev_client_secret",
    { expiresIn: "1h" }
  );

  res.json({ token });
};

// --- /api/auth/me (opcional, útil para probar el token) ---
export const me = (req, res) => {
  res.json({ ok: true, user: req.user || null });
};
export const validateToken = (req, res) => {
  // authAny ya validó el token
  res.json({ valid: true, userId: req.user?.id || null });
};
export const generarTokenServicio = (req, res) => {
  const { restaurantId } = req.body;
  if (!restaurantId) return res.status(400).json({ error: "Falta restaurantId" });

  const token = jwt.sign(
    { restaurantId, rol: "kitchen" }, 
    process.env.JWT_SERVICE_SECRET || "dev_service_secret", 
    { expiresIn: "365d" } // duración larga
  );

  res.json({ token });
};