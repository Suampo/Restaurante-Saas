// routes/split/cash.routes.js
const express = require('express');
const router = express.Router();
const pool = require('../../db'); // tu pool de node-postgres
const { verifyCsrf } = require('../../middlewares/csrf');

// helper para validar PIN del restaurante (ajústalo a tu lógica actual)
async function validateCashPin(restaurantId, pin, client=pool) {
  // usa el mismo algoritmo que ya tienes en tu proyecto
  const { rows } = await client.query(`
    SELECT cash_pin_hash FROM restaurantes WHERE id = $1
  `, [restaurantId]);
  if (!rows[0]?.cash_pin_hash) return { ok:false, reason:'PIN no configurado' };
  // ejemplo simple: compara sha256(pin || '::' || restaurant_id || '::' || SALT)
  // ... tu validación acá ...
  return { ok:true };
}

router.post('/pedidos/:pedidoId/pagos/:pagoId/aprobar', verifyCsrf, async (req, res) => {
  const { pedidoId, pagoId } = req.params;
  const { pin, received, note } = req.body || {};
  const approver   = req.get('x-app-user')    || 'mozo@desconocido';
  const approverId = req.get('x-app-user-id') || null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Traer pago + restaurante
    const { rows: pagos } = await client.query(`
      SELECT p.id, p.pedido_id, p.monto, p.restaurant_id, p.metodo, p.estado
      FROM pagos p
      WHERE p.id=$1 AND p.pedido_id=$2
      FOR UPDATE
    `, [pagoId, pedidoId]);
    const pago = pagos[0];
    if (!pago) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pago no encontrado' }); }
    if (pago.metodo !== 'efectivo') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No es pago en efectivo' }); }
    if (pago.estado === 'approved') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Ya aprobado' }); }

    // 2) Validar PIN
    const v = await validateCashPin(pago.restaurant_id, pin, client);
    if (!v.ok) { await client.query('ROLLBACK'); return res.status(409).json({ error: v.reason || 'PIN inválido' }); }

    // 3) Aprobar + calcular vuelto si mandaron "received"
    const { rows: upd } = await client.query(`
      UPDATE pagos
      SET estado           = 'approved',
          approved_at      = now(),
          approved_by      = $1,
          approved_by_user_id = COALESCE($2::uuid, approved_by_user_id),
          cash_received    = $3,
          cash_change      = CASE
                               WHEN $3::numeric IS NOT NULL
                               THEN GREATEST($3::numeric - monto, 0)
                               ELSE cash_change
                             END,
          cash_note        = $4
      WHERE id = $5
      RETURNING id, pedido_id, monto, cash_received, cash_change, approved_by, approved_at
    `, [approver, approverId, received, note, pagoId]);

    const approved = upd[0];

    // 4) (Opcional) movimiento de caja
    // await client.query(`
    //   INSERT INTO cash_movements (restaurant_id, pago_id, type, amount, created_by, note)
    //   VALUES ($1,$2,'in',$3,$4,$5)
    // `, [pago.restaurant_id, pagoId, pago.monto, approverId, note || null]);

    await client.query('COMMIT');
    res.json({ status: 'approved', pago: approved });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    res.status(500).json({ error: 'Error aprobando efectivo' });
  } finally {
    client.release();
  }
});

module.exports = router;
