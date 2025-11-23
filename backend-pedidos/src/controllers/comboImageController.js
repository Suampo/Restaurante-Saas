// src/controllers/comboImageController.js
import { pool } from "../config/db.js";
import { supabase } from "../config/supabase.js";
import { fileTypeFromBuffer } from "file-type";
import crypto from "crypto";
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

export const uploadComboCover = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId; // de authTenant
    const { id } = req.params;

    if (!req.file) {
      return res
        .status(400)
        .json({ error: "Falta el archivo 'image' en form-data" });
    }

    // verificación real de firma (no solo mimetype)
    const ft = await fileTypeFromBuffer(req.file.buffer);
    if (!ft || !ALLOWED.has(ft.mime)) {
      return res.status(400).json({
        error: "Archivo no es imagen válida (jpg/png/webp/gif)",
      });
    }

    // validar que el combo pertenece al restaurante
    const { rows } = await pool.query(
      "SELECT id FROM combos WHERE id = $1 AND restaurant_id = $2",
      [id, restaurantId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "Combo no encontrado" });
    }

    // 🔁 Convertir SIEMPRE a WebP
    const webpBuffer = await sharp(req.file.buffer)
      .rotate()
      .webp({ quality: 80 })
      .toBuffer();

    const bucket = process.env.SUPABASE_BUCKET_COMBOS || "combos";
    const ext = "webp";
    const key = `restaurants/${restaurantId}/combos/${id}/${uuid()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(key, webpBuffer, {
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

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(key);
    const coverUrl = pub.publicUrl;

    const { rows: updated } = await pool.query(
      `UPDATE combos
       SET cover_url = $3
       WHERE id = $1 AND restaurant_id = $2
       RETURNING id, nombre, cover_url`,
      [id, restaurantId, coverUrl]
    );

    return res.json(updated[0]);
  } catch (err) {
    console.error("❌ uploadComboCover:", err);
    return res.status(500).json({ error: "Error subiendo imagen" });
  }
};
