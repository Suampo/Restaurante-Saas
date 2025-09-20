// src/middlewares/requireRestaurantMember.js
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL });

export async function requireRestaurantMember(req, res, next) {
  try {
    const userId = req.user?.id;                // lo debe setear requireDbToken
    const restaurantId = req.user?.restaurantId;
    if (!userId || !restaurantId) {
      return res.status(401).json({ error: "No autorizado" });
    }

    // Valida membresía (ajusta a tu modelo; si no usas esta tabla, salta esto)
    const { rowCount } = await pool.query(
      `SELECT 1 FROM restaurant_members WHERE user_id = $1 AND restaurant_id = $2 LIMIT 1`,
      [userId, restaurantId]
    );
    if (!rowCount) return res.status(403).json({ error: "Sin acceso al restaurante" });

    // Propaga restaurantId a la request para las consultas
    req.restaurantId = restaurantId;
    next();
  } catch (err) {
    console.error("[authz] requireRestaurantMember", err);
    res.status(500).json({ error: "Error de autorización" });
  }
}
