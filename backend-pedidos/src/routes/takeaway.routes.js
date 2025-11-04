// src/routes/takeaway.routes.js
import { Router } from "express";
import QRCode from "qrcode";
import crypto from "crypto";
import { pool } from "../config/db.js";
import { authTenant } from "../middlewares/authTenant.js";

const router = Router();

// Helpers
const base64url = (buf) =>
  buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

const signQR = ({ restaurantId, mesaId, codigo }) => {
  const secret = process.env.QR_SECRET || "dev-qr-secret";
  const msg = `${restaurantId}:${mesaId}:${codigo}`;
  const mac = crypto.createHmac("sha256", secret).update(msg).digest();
  return base64url(mac);
};

/**
 * Crea/asegura la mesa "LLEVAR" (solo admin con tenant)
 */
router.post("/takeaway/ensure", authTenant, async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(401).json({ error: "No autorizado" });

    // Inserta si no existe (unique por (restaurant_id, codigo) en tu esquema)
    await pool.query(
      `
      insert into public.mesas (restaurant_id, codigo, descripcion)
      values ($1, 'LLEVAR', 'Pedidos para llevar')
      on conflict (restaurant_id, codigo) do nothing
      `,
      [restaurantId]
    );

    const { rows } = await pool.query(
      `select id, codigo from public.mesas where restaurant_id=$1 and codigo='LLEVAR' limit 1`,
      [restaurantId]
    );

    return res.json({ ok: true, mesa: rows[0] || null });
  } catch (e) {
    console.error("POST /takeaway/ensure", e);
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * Info de la mesa LLEVAR (admin)
 */
router.get("/takeaway/info", authTenant, async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(401).json({ error: "No autorizado" });

    const { rows } = await pool.query(
      `select id, codigo from public.mesas where restaurant_id=$1 and codigo='LLEVAR' limit 1`,
      [restaurantId]
    );
    if (!rows.length) return res.status(404).json({ error: "No existe LLEVAR" });

    res.json({ mesaId: rows[0].id, codigo: rows[0].codigo });
  } catch (e) {
    console.error("GET /takeaway/info", e);
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * Info pública de LLEVAR (por restaurantId)
 */
router.get("/public/takeaway/info", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId || 0);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });

    const { rows } = await pool.query(
      `select id, codigo from public.mesas where restaurant_id=$1 and codigo='LLEVAR' limit 1`,
      [restaurantId]
    );
    if (!rows.length) return res.status(404).json({ error: "No existe LLEVAR" });

    res.json({ mesaId: rows[0].id, codigo: rows[0].codigo });
  } catch (e) {
    console.error("GET /public/takeaway/info", e);
    res.status(500).json({ error: "Error interno" });
  }
});

/**
 * Genera QR (PNG Base64) con los parámetros para LLEVAR (solo admin)
 * Nota: esto incluye mesaId para construir la URL del cliente,
 * pero **NO** se usará al crear intents (allí mesa_id será NULL).
 */
router.get("/takeaway/qr", authTenant, async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId || 0);
    if (!restaurantId) return res.status(401).json({ error: "No autorizado" });

    const PUBLIC_URL = (process.env.CLIENT_PUBLIC_URL || "http://localhost:5174").replace(/\/+$/, "");

    const r = await pool.query(
      `select id, codigo from public.mesas where restaurant_id=$1 and codigo='LLEVAR' limit 1`,
      [restaurantId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "No existe LLEVAR" });

    const { id: mesaId, codigo } = r.rows[0];
    const s = signQR({ restaurantId, mesaId, codigo });

    const url =
      `${PUBLIC_URL}/?mesaId=${encodeURIComponent(mesaId)}` +
      `&restaurantId=${encodeURIComponent(restaurantId)}` +
      `&mesaCode=${encodeURIComponent(codigo)}&takeaway=1&s=${encodeURIComponent(s)}`;

    const png = await QRCode.toDataURL(url, { width: 640, margin: 1 });
    res.json({ ok: true, mesaId, url, png });
  } catch (e) {
    console.error("GET /takeaway/qr", e);
    res.status(500).json({ error: "Error generando QR" });
  }
});

/**
 * Crea SIEMPRE un nuevo checkout_intent para LLEVAR (concurrencia).
 * IMPORTANTE: Por regla de negocio/constraint:
 *   order_type='takeaway' => mesa_id debe ser NULL
 */
router.post("/takeaway/checkout-intents", async (req, res) => {
  try {
    const rid = Number(req.body.restaurantId);
    const amount = Number(req.body.amount);
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
    const note = req.body.note ?? null;

    // Ignoramos explícitamente cualquier mesaId recibido para cumplir el CHECK
    // const mid = Number(req.body.mesaId); // NO USAR

    if (!rid || !amount || amount <= 0) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const expiresMins = Number(process.env.CHECKOUT_EXPIRES_MIN || 15);

    const r = await pool.query(
      `INSERT INTO checkout_intents (
         restaurant_id, mesa_id, amount, cart, note, status, order_type, expires_at
       )
       VALUES ($1, NULL, $2, $3, $4, 'pending', 'takeaway', now() + ($5 || ' minutes')::interval)
       RETURNING *`,
      [rid, amount, JSON.stringify(cart), note, String(expiresMins)]
    );

    res.json(r.rows[0]);
  } catch (e) {
    console.error("POST /takeaway/checkout-intents", e);
    res.status(500).json({ error: "Error creando intent" });
  }
});

export default router;
