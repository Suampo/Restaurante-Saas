// routes/public.mesas.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

/**
 * GET /api/public/mesas/resolve?restaurantId=2&mesaCode=MESA-1
 * -> { id: 7 }
 */
router.get("/public/mesas/resolve", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId || 0);
    const mesaCode = String(req.query.mesaCode || "").trim();
    if (!restaurantId || !mesaCode) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const { rows } = await pool.query(
      `SELECT id FROM public.mesas
       WHERE restaurant_id = $1 AND (codigo = $2 OR lower(codigo) = lower($2))
       LIMIT 1`,
      [restaurantId, mesaCode]
    );
    if (!rows.length) return res.status(404).json({ error: "Mesa no encontrada" });

    res.set("Cache-Control","public, max-age=300, stale-while-revalidate=86400");
    return res.json({ id: rows[0].id });
  } catch (err) {
    console.error("GET /public/mesas/resolve", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
