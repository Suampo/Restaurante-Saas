// src/controllers/authController.js
import { pool } from "../config/db.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const IS_PROD =
  String(process.env.NODE_ENV || "development").toLowerCase() === "production";

// 🔐 Secretos
// Admin (legacy auth /admin, NO dbToken: ese se firma en signDbToken.js)
const ADMIN_SECRET =
  process.env.SUPABASE_JWT_SECRET ||
  (!IS_PROD ? "dev_admin_secret" : null);

// Cliente (frontend-cliente)
const CLIENT_SECRET =
  process.env.JWT_CLIENT_SECRET ||
  (!IS_PROD ? "dev_client_secret" : null);

// Servicio (KDS / cocina)
const SERVICE_SECRET =
  process.env.JWT_SERVICE_SECRET ||
  (!IS_PROD ? "dev_service_secret" : null);

// ✅ En producción, obligamos a que existan los secretos reales
if (IS_PROD) {
  if (!process.env.SUPABASE_JWT_SECRET) {
    throw new Error(
      "SUPABASE_JWT_SECRET requerido en producción (dbToken/admin)"
    );
  }
  if (!process.env.JWT_CLIENT_SECRET) {
    throw new Error(
      "JWT_CLIENT_SECRET requerido en producción (tokens de cliente)"
    );
  }
  if (!process.env.JWT_SERVICE_SECRET) {
    throw new Error(
      "JWT_SERVICE_SECRET requerido en producción (token de servicio/KDS)"
    );
  }
}

// --- Login ADMIN (email + password con bcrypt / fallback texto) ---
export const login = async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Faltan credenciales" });
    }

    const result = await pool.query(
      `SELECT
         id,
         restaurant_id,
         nombre,
         email,
         rol,
         password_hash,
         password               -- 👈 password en texto (legacy)
       FROM usuarios
       WHERE lower(email) = $1
       LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const u = result.rows[0];

    // 👇 Primero intentamos con bcrypt, si no hay hash usamos password plano
    let ok = false;
    if (u.password_hash) {
      ok = await bcrypt.compare(password, u.password_hash);
    } else if (u.password) {
      ok = password === u.password;
    }

    if (!ok) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = jwt.sign(
      { userId: u.id, restaurantId: u.restaurant_id, rol: u.rol || "admin" },
      ADMIN_SECRET,
      { expiresIn: "8h" } // ⏱ 8h para este flujo legacy
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
  if (!restaurantId) {
    return res.status(400).json({ error: "Falta restaurantId" });
  }

  const expiresSeconds = 2 * 60 * 60; // 2h

  const token = jwt.sign(
    {
      type: "client",
      rol: "client",
      restaurantId,
    },
    CLIENT_SECRET,
    { expiresIn: expiresSeconds }
  );

  res.json({ token, expiresIn: expiresSeconds });
};

// --- POST /api/auth/token-temporal (nuevo) ---
export const generarTokenTemporal = (req, res) => {
  const { restaurantId, mesaId } = req.body;

  if (!restaurantId || !mesaId) {
    return res
      .status(400)
      .json({ error: "Faltan restaurantId o mesaId" });
  }

  const expiresSeconds = 60 * 60; // 1h

  const token = jwt.sign(
    { restaurantId, mesaId, rol: "client" },
    CLIENT_SECRET,
    { expiresIn: expiresSeconds }
  );

  res.json({ token, expiresIn: expiresSeconds });
};

// --- /api/auth/me ---
export const me = (req, res) => {
  res.json({ ok: true, user: req.user || null });
};

export const validateToken = (req, res) => {
  res.json({ valid: true, userId: req.user?.id || null });
};

// --- Token para servicio KDS / cocina ---
export const generarTokenServicio = (req, res) => {
  const { restaurantId } = req.body;
  if (!restaurantId) {
    return res.status(400).json({ error: "Falta restaurantId" });
  }

  const expiresSeconds = 30 * 24 * 60 * 60; // 30 días

  const token = jwt.sign(
    { restaurantId, rol: "kitchen" },
    SERVICE_SECRET,
    { expiresIn: expiresSeconds }
  );

  res.json({ token, expiresIn: expiresSeconds });
};
