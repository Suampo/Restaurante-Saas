// backend-pedidos/src/routes/checkout.routes.js
import { Router } from "express";
import pkg from "pg";
const { Pool } = pkg;

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// Valida mesa sólo si el flujo es dine-in
async function assertMesaIfDinein(req, res, next) {
  try {
    const { restaurantId, mesaId, orderType } = req.body || {};
    if (orderType === "takeaway") return next();

    const rid = Number(restaurantId);
    const mid = Number(mesaId);
    if (!rid || !mid) return res.status(400).json({ error: "restaurantId y mesaId requeridos" });

    const q = await pool.query(
      "SELECT 1 FROM mesas WHERE id=$1 AND restaurant_id=$2",
      [mid, rid]
    );
    if (!q.rowCount) return res.status(404).json({ error: "Mesa no encontrada" });

    next();
  } catch (e) {
    console.error("[assertMesaIfDinein]", e);
    res.status(500).json({ error: "Error validando mesa" });
  }
}

/**
 * POST /api/checkout/intents
 * Body:
 *   - dinein:   { restaurantId, mesaId, amount, cart[], note? , orderType: 'dinein' }
 *   - takeaway: { restaurantId, amount, cart[], note?, orderType: 'takeaway' }
 */
router.post("/intents", assertMesaIfDinein, async (req, res) => {
  try {
    const rid = Number(req.body.restaurantId);
    const amount = Number(req.body.amount);
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];
    const note = req.body.note ?? null;

    const orderType = req.body.orderType === "takeaway" ? "takeaway" : "dinein";
    const mesaId = orderType === "dinein" ? Number(req.body.mesaId) : null;

    if (!rid || !amount || amount <= 0) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }
    if (orderType === "dinein" && !mesaId) {
      return res.status(400).json({ error: "mesaId requerido para dinein" });
    }

    const expiresMins = Number(process.env.CHECKOUT_EXPIRES_MIN || 15);
    const expiresSql = `now() + ($1 || ' minutes')::interval`;

    let sql, params;

    if (orderType === "dinein") {
      // SIEMPRE crear un intent nuevo (sin ON CONFLICT)
      sql = `
        INSERT INTO checkout_intents
          (restaurant_id, mesa_id, order_type, amount, currency, cart, note, status, expires_at)
        VALUES
          ($2, $3, 'dinein', $4, 'PEN', $5::jsonb, $6, 'pending', ${expiresSql})
        RETURNING *;
      `;
      params = [String(expiresMins), rid, mesaId, amount, JSON.stringify(cart), note];
    } else {
      // TAKEAWAY: no exigir externalReference; lo generamos si falta
      sql = `
        INSERT INTO checkout_intents
          (restaurant_id, order_type, amount, currency, cart, note, status, expires_at)
        VALUES
          ($2, 'takeaway', $3, 'PEN', $4::jsonb, $5, 'pending', ${expiresSql})
        RETURNING *;
      `;
      params = [String(expiresMins), rid, amount, JSON.stringify(cart), note];
    }

    const { rows } = await pool.query(sql, params);
    const intent = rows[0];

    // Asegurar external_reference único (cumplir UNIQUE y trazabilidad)
    if (!intent.external_reference) {
      const er = String(intent.id); // id es UUID → suficiente para ser único
      const u = await pool.query(
        `UPDATE checkout_intents
           SET external_reference=$1, updated_at=now()
         WHERE id=$2
         RETURNING *`,
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

/** Abandonar intent (cuando cierras el modal sin pagar) */
router.post("/intents/:id/abandon", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents SET status='abandoned', updated_at=now()
       WHERE id=$1 AND status='pending'`,
      [id]
    );
    return res.json({ ok: !!r.rowCount });
  } catch (e) {
    console.error("abandon intent", e);
    res.status(500).json({ error: "No se pudo abandonar la intent" });
  }
});

/** Expirar una intent si ya venció */
router.post("/intents/:id/expire", async (req, res) => {
  try {
    const { id } = req.params;
    const r = await pool.query(
      `UPDATE checkout_intents
         SET status='expired', updated_at=now()
       WHERE id=$1 AND status='pending' AND expires_at < now()`,
      [id]
    );
    res.json({ ok: !!r.rowCount });
  } catch (e) {
    console.error("expire intent", e);
    res.status(500).json({ error: "No se pudo expirar la intent" });
  }
});

export default router;
