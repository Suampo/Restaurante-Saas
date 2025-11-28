// src/controllers/menuImageController.js
import { pool } from "../config/db.js";
import { supabase } from "../config/supabase.js";
import crypto from "crypto";
import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";

const uuid = () =>
  (crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString("hex"));

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const MAX_SIZE = 1600;

export const uploadMenuImage = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const { id } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Falta el archivo 'image' en form-data" });
    }

    // Verificación real de firma (no solo mimetype)
    const ft = await fileTypeFromBuffer(req.file.buffer);
    if (!ft || !ALLOWED.has(ft.mime)) {
      return res.status(400).json({
        error: "Archivo no es una imagen válida (jpg/png/webp/gif)",
      });
    }

    // item existe y es del restaurante
    const { rows } = await pool.query(
      "SELECT id, imagen_url FROM menu_items WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: "Item no encontrado" });
    }

    // 🔁 Convertir SIEMPRE a WebP, limitado a MAX_SIZE
    const webpBuffer = await sharp(req.file.buffer)
      .rotate()
      .resize({
        width: MAX_SIZE,
        height: MAX_SIZE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80 })
      .toBuffer();

    const bucket =
      process.env.SUPABASE_BUCKET_MENU ||
      process.env.SUPABASE_BUCKET || // tu bucket viejo (menu-images) si lo sigues usando
      "menu-items";

    const ext = "webp";
    const path = `restaurants/${restaurantId}/menu_items/${id}/${uuid()}.${ext}`;

    // Subida
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, webpBuffer, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "31536000",
      });

    if (upErr) {
      console.error("❌ Supabase upload:", upErr);
      return res.status(500).json({
        error: "Error subiendo imagen",
        detail: upErr.message || String(upErr),
      });
    }

    // URL pública (si el bucket es público)
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    const { rows: updated } = await pool.query(
      `UPDATE menu_items
       SET imagen_url = $3
       WHERE id = $1 AND restaurant_id = $2
       RETURNING id, nombre, descripcion, precio, imagen_url, activo`,
      [id, restaurantId, publicUrl]
    );

    return res.json(updated[0]);
  } catch (err) {
    console.error("❌ uploadMenuImage:", err);
    return res.status(500).json({ error: "Error subiendo imagen" });
  }
};
