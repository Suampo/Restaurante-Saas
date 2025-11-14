// server/img.js  (ESM)
import express from "express";
import sharp from "sharp";
import fetch from "node-fetch";

export const imgRouter = express.Router();

/**
 * GET /img?url=<http/https>&width=240&height=&q=70&fmt=webp&fit=cover|inside
 * - url   : imagen origen (http/https). data:/blob: se ignoran (no tiene sentido proxearlas)
 * - width : ancho destino (min 40)
 * - height: opcional. Si viene y fit=cover, recorta manteniendo centro
 * - q     : calidad (40..95)
 * - fmt   : webp|avif|jpeg|png (default webp)
 * - fit   : cover|inside (default inside)
 */
imgRouter.get("/", async (req, res) => {
  try {
    const rawUrl = String(req.query.url || "");
    if (!/^https?:\/\//i.test(rawUrl)) return res.status(400).send("bad url");

    const width  = Math.max(40, parseInt(req.query.width ?? "240", 10));
    const height = req.query.height ? Math.max(40, parseInt(req.query.height, 10)) : null;
    const q      = Math.min(95, Math.max(40, parseInt(req.query.q ?? "70", 10)));
    const fit    = (req.query.fit || "inside").toString() === "cover" ? "cover" : "inside";

    // negociación de formato según el navegador
    const accept = (req.headers["accept"] || "").toLowerCase();
    const want   = (req.query.fmt || req.query.format || "").toString().toLowerCase();
    const fmt    =
      ["webp", "avif", "jpeg", "png"].includes(want)
        ? want
        : accept.includes("image/avif")
          ? "avif"
          : accept.includes("image/webp")
            ? "webp"
            : "jpeg";

    const upstream = await fetch(rawUrl, { timeout: 15000 });
    if (!upstream.ok) return res.status(502).send("upstream error");
    const buf = Buffer.from(await upstream.arrayBuffer());

    const base = sharp(buf).rotate(); // respeta EXIF
    const resized = base.resize(
      { width, height: height || undefined, fit, withoutEnlargement: true }
    );

    let pipeline = resized;
    if (fmt === "webp") pipeline = resized.webp({ quality: q });
    else if (fmt === "avif") pipeline = resized.avif({ quality: q });
    else if (fmt === "jpeg") pipeline = resized.jpeg({ quality: q, mozjpeg: true });
    else pipeline = resized.png(); // png sin pérdida

    const out = await pipeline.toBuffer();
    res.set("Content-Type", `image/${fmt}`);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(out);
  } catch (err) {
    res.status(500).send("img error");
  }
});
