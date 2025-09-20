// backend-facturacion/src/routes/checkout.routes.js
const { Router } = require("express");
const { Pool } = require("pg");

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// Verifica mesa ∈ restaurant (restaurantId:int, mesaId:int)
async function assertMesa(req, res, next) {
  const body = req.body || {};
  const restaurantId = Number(body.restaurantId ?? req.query.restaurantId);
  const mesaId = Number(body.mesaId ?? req.query.mesaId);
  if (!restaurantId || !mesaId) {
    return res.status(400).json({ error: "restaurantId y mesaId requeridos" });
  }
  try {
    const r = await pool.query(
      "SELECT 1 FROM mesas WHERE id = $1::int AND restaurant_id = $2::int",
      [mesaId, restaurantId]
    );
    if (!r.rowCount) return res.status(404).json({ error: "Mesa no encontrada" });
    next();
  } catch (e) {
    console.error("[assertMesa]", e);
    res.status(500).json({ error: "Error validando mesa" });
  }
}

// Crea/actualiza intent idempotente por mesa
router.post("/intents", assertMesa, async (req, res) => {
  const { restaurantId, mesaId, amount, cart = [], note = null } = req.body;
  const expiresMins = Number(process.env.CHECKOUT_EXPIRES_MIN || 15);

  try {
    const r = await pool.query(
      `INSERT INTO checkout_intents (restaurant_id, mesa_id, amount, cart, note, status, expires_at)
       VALUES ($1::int,$2::int,$3::numeric,$4::jsonb,$5::text,'pending', now() + ($6 || ' minutes')::interval)
       ON CONFLICT (restaurant_id, mesa_id)
       DO UPDATE SET amount     = EXCLUDED.amount,
                     cart       = EXCLUDED.cart,
                     note       = EXCLUDED.note,
                     updated_at = now(),
                     expires_at = EXCLUDED.expires_at
       RETURNING *`,
      [Number(restaurantId), Number(mesaId), Number(amount), JSON.stringify(cart), note, String(expiresMins)]
    );

    const intent = r.rows[0];
    if (!intent.external_reference) {
      const u = await pool.query(
        `UPDATE checkout_intents SET external_reference=$1 WHERE id=$2 RETURNING *`,
        [String(intent.id), intent.id]
      );
      return res.status(201).json(u.rows[0]);
    }
    res.status(201).json(intent);
  } catch (e) {
    console.error("POST /api/checkout/intents", e);
    res.status(500).json({ error: "No se pudo crear la intent" });
  }
});

router.post("/intents/:id/abandon", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents
       SET status='abandoned', updated_at=now()
       WHERE id=$1::uuid AND status='pending'
       RETURNING id`,
      [String(id)]
    );
    if (!r.rowCount) return res.status(409).json({ ok: false, reason: "not-pending" });
    res.json({ ok: true });
  } catch (e) {
    console.error("abandon intent", e);
    res.status(500).json({ error: "No se pudo abandonar la intent" });
  }
});

router.post("/intents/:id/expire", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents
       SET status='expired', updated_at=now()
       WHERE id=$1::uuid AND status='pending' AND expires_at < now()
       RETURNING id`,
      [String(id)]
    );
    res.json({ ok: !!r.rowCount });
  } catch (e) {
    console.error("expire intent", e);
    res.status(500).json({ error: "No se pudo expirar la intent" });
  }
});

module.exports = router;
