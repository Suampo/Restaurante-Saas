// routes/public.restaurants.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/**
 * GET /public/restaurants/:id
 * Devuelve { id, nombre, direccion, telefono, billing_mode, cover_url }
 */
router.get("/public/restaurants/:id", async (req, res) => {
  try {
    const id = Number(req.params.id || 0);
    if (!id) return res.status(400).json({ message: "id inválido" });

    const { rows } = await pool.query(
      `SELECT
         id,
         nombre,
         direccion,
         telefono,
         COALESCE(billing_mode,'none') AS billing_mode,
         cover_url
       FROM public.restaurantes
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "No encontrado" });
    }

    res.set(
      "Cache-Control",
      "public, max-age=600, stale-while-revalidate=86400"
    );
    return res.json(rows[0]); // { id, nombre, direccion, telefono, billing_mode, cover_url }
  } catch (err) {
    console.error("GET /public/restaurants/:id", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

export default router;
