// backend-pedidos/src/routes/checkout.routes.js (ESM)
import { Router } from "express";
import pkg from "pg";
const { Pool } = pkg;

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// Valida que la mesa pertenezca al restaurante (ambos numéricos)
async function assertMesa(req, res, next) {
  const { restaurantId, mesaId } = req.body?.restaurantId ? req.body : req.query;
  const rid = Number(restaurantId);
  const mid = Number(mesaId);
  if (!rid || !mid) return res.status(400).json({ error: "restaurantId y mesaId requeridos" });
  try {
    const q = await pool.query(
      "SELECT 1 FROM mesas WHERE id=$1 AND restaurant_id=$2",
      [mid, rid]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Mesa no encontrada" });
    next();
  } catch (e) {
    console.error("[assertMesa]", e);
    res.status(500).json({ error: "Error validando mesa" });
  }
}

/**
 * POST /api/checkout/intents
 * Body: { restaurantId (int), mesaId (int), amount (number), cart (json[]), note? }
 */
router.post("/intents", assertMesa, async (req, res) => {
  try {
    const rid = Number(req.body.restaurantId);
    const mid = Number(req.body.mesaId);
    const amount = Number(req.body.amount);
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
    const note = req.body.note ?? null;

    if (!rid || !mid || !amount || amount <= 0) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    const expiresMins = Number(process.env.CHECKOUT_EXPIRES_MIN || 15);

    const r = await pool.query(
      `INSERT INTO checkout_intents (restaurant_id, mesa_id, amount, cart, note, status, expires_at)
       VALUES ($1,$2,$3,$4,$5,'pending', now() + ($6 || ' minutes')::interval)
       ON CONFLICT (restaurant_id, mesa_id) WHERE checkout_intents.status='pending'
       DO UPDATE SET amount = EXCLUDED.amount,
                     cart = EXCLUDED.cart,
                     note = EXCLUDED.note,
                     updated_at = now(),
                     expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [rid, mid, amount, JSON.stringify(cart), note, String(expiresMins)]
    );

    // si no tiene external_reference, usa el id (uuid generado por la tabla) o el propio PK
    const intent = r.rows[0];

    // si tu columna id es uuid default gen_random_uuid() deja esto;
    // si es serial, puedes usar String(intent.id)
    if (!intent.external_reference) {
      const er = String(intent.id);
      const u = await pool.query(
        `UPDATE checkout_intents SET external_reference=$1 WHERE id=$2 RETURNING *`,
        [er, intent.id]
      );
      return res.status(201).json(u.rows[0]);
    }

    res.status(201).json(intent);
  } catch (e) {
    console.error("POST /api/checkout/intents error:", e);
    res.status(500).json({ error: "No se pudo crear la intent" });
  }
});

/**
 * POST /api/checkout/intents/:id/abandon
 */
router.post("/intents/:id/abandon", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents
         SET status='abandoned', updated_at=now()
       WHERE id=$1 AND status='pending'
       RETURNING id`,
      [id]
    );
    if (!r.rowCount) return res.status(409).json({ ok: false, reason: "not-pending" });
    res.json({ ok: true });
  } catch (e) {
    console.error("abandon intent", e);
    res.status(500).json({ error: "No se pudo abandonar la intent" });
  }
});

/**
 * POST /api/checkout/intents/:id/expire
 */
router.post("/intents/:id/expire", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents
         SET status='expired', updated_at=now()
       WHERE id=$1 AND status='pending' AND expires_at < now()
       RETURNING id`,
      [id]
    );
    res.json({ ok: !!r.rowCount });
  } catch (e) {
    console.error("expire intent", e);
    res.status(500).json({ error: "No se pudo expirar la intent" });
  }
});

export default router;
