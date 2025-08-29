// routes/public.restaurants.js
import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/public/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT id, nombre FROM restaurantes WHERE id = $1 LIMIT 1",
      [id]
    );
    if (!rows.length) return res.status(404).json({ message: "No encontrado" });

    // 👇 Cachea 10 min en el navegador y permite servir mientras revalida en background
    res.set(
      "Cache-Control",
      "public, max-age=600, stale-while-revalidate=86400"
    );

    return res.json(rows[0]); // { id, nombre }
  } catch (err) {
    console.error("GET /public/restaurants/:id", err);
    return res.status(500).json({ message: "Error interno" });
  }
});

export default router;
