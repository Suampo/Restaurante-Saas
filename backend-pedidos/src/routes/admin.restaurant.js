// backend-pedidos/src/routes/admin.restaurant.js
import { Router } from "express";
import { pool } from "../config/db.js";
import { upload } from "../middlewares/multer.js"; // ✅ tu multer real
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const router = Router();

// Necesario para armar la ruta física donde guardar las imágenes
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carpeta donde guardaremos las portadas (local)
const COVERS_DIR = path.join(__dirname, "..", "menu_images");

// Nos aseguramos de que exista
if (!fs.existsSync(COVERS_DIR)) {
  fs.mkdirSync(COVERS_DIR, { recursive: true });
}

/**
 * GET /api/restaurant
 * Devuelve la configuración del restaurante del usuario logueado
 */
router.get("/", async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId faltante" });
    }

    const { rows } = await pool.query(
      `SELECT
         id,
         nombre,
         direccion,
         telefono,
         COALESCE(billing_mode, 'none') AS billing_mode,
         cover_url
       FROM public.restaurantes
       WHERE id = $1
       LIMIT 1`,
      [restaurantId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "No encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("[admin.restaurant] GET /api/restaurant", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

/**
 * PUT /api/restaurant
 * Actualiza nombre, dirección y teléfono (texto plano)
 */
router.put("/", async (req, res) => {
  try {
    const restaurantId = req.restaurantId;
    const role = req.user?.role || req.user?.rol || "admin";

    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId faltante" });
    }

    // Solo admin/owner pueden cambiar configuración
    if (!["admin", "owner"].includes(role)) {
      return res.status(403).json({ error: "Sin permisos" });
    }

    const { nombre, direccion, telefono } = req.body || {};

    const { rows } = await pool.query(
      `UPDATE public.restaurantes
       SET
         nombre    = COALESCE($2, nombre),
         direccion = COALESCE($3, direccion),
         telefono  = COALESCE($4, telefono)
       WHERE id = $1
       RETURNING
         id,
         nombre,
         direccion,
         telefono,
         COALESCE(billing_mode,'none') AS billing_mode,
         cover_url`,
      [restaurantId, nombre, direccion, telefono]
    );

    if (!rows.length) {
      return res.status(404).json({ error: "No encontrado" });
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error("[admin.restaurant] PUT /api/restaurant", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

/**
 * POST /api/restaurant/cover
 * Sube una imagen, la convierte a WEBP y actualiza cover_url
 * Campo de formulario esperado: "cover"
 */
router.post(
  "/cover",
  upload.single("cover"), // ✅ usa tu multer de middlewares
  async (req, res) => {
    try {
      const restaurantId = req.restaurantId;
      const role = req.user?.role || req.user?.rol || "admin";

      if (!restaurantId) {
        return res.status(400).json({ error: "restaurantId faltante" });
      }

      if (!["admin", "owner"].includes(role)) {
        return res.status(403).json({ error: "Sin permisos" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Archivo 'cover' requerido" });
      }

      // Nombre de archivo consistente
      const fileName = `rest-${restaurantId}-cover-${Date.now()}.webp`;
      const outPath = path.join(COVERS_DIR, fileName);

      // Convertimos SIEMPRE a WEBP
      await sharp(req.file.buffer)
        .rotate() // corrige orientación
        .resize({ width: 1280, height: 720, fit: "cover" }) // tamaño razonable
        .toFormat("webp", { quality: 80 })
        .toFile(outPath);

      // Ruta pública relativa (la servirá el server con express.static)
      const publicPath = `/menu_images/${fileName}`;

      await pool.query(
        `UPDATE public.restaurantes
         SET cover_url = $2
         WHERE id = $1`,
        [restaurantId, publicPath]
      );

      return res.json({ cover_url: publicPath });
    } catch (err) {
      console.error("[admin.restaurant] POST /api/restaurant/cover", err);
      return res.status(500).json({ error: "Error interno" });
    }
  }
);

export default router;
