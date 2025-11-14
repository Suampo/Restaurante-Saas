// backend-facturacion/src/middlewares/ensureIntentActive.js
// Verifica que el checkout_intent exista, esté 'pending' y NO esté vencido.
// Si venció, responde 410 y (best-effort) lo marca como 'expired'.
// Requiere: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

const { supabase } = require('../services/supabase');

module.exports = async function ensureIntentActive(req, res, next) {
  try {
    if (String(process.env.INTENTS_TTL_ENFORCE || '1') === '0') return next();

    const body = req.body || {};
    const md = body.metadata || {};
    const intentId = md.intentId || req.query.intentId || null;
    const rid = Number(md.restaurantId || req.query.restaurantId || 0);

    if (!intentId) {
      return res.status(400).json({ error: 'INTENT_REQUIRED', message: 'Falta intentId en metadata o query.' });
    }

    const { data: intent, error } = await supabase
      .from('checkout_intents')
      .select('id,status,expires_at,restaurant_id,pedido_id')
      .eq('id', intentId)
      .single();

    if (error || !intent) return res.status(404).json({ error: 'INTENT_NOT_FOUND' });

    if (rid && Number(intent.restaurant_id) !== rid) {
      return res.status(403).json({ error: 'INTENT_FORBIDDEN' });
    }

    const now = new Date();
    const expiresAt = intent.expires_at ? new Date(intent.expires_at) : null;

    const notPending = ['approved', 'failed', 'abandoned', 'expired'];
    if (intent.status && notPending.includes(String(intent.status))) {
      return res.status(409).json({ error: 'INTENT_NOT_PENDING', status: intent.status });
    }

    if (expiresAt && now >= expiresAt) {
      try {
        await supabase
          .from('checkout_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', intent.id);
      } catch (_) {}
      return res.status(410).json({
        error: 'INTENT_EXPIRED',
        message: 'El intento de pago ha vencido. Vuelve a escanear el QR e inicia el pago de nuevo.',
      });
    }

    if (intent.pedido_id) {
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('estado')
        .eq('id', intent.pedido_id)
        .single();
      if (pedido && pedido.estado && pedido.estado !== 'pendiente_pago') {
        return res.status(409).json({ error: 'PEDIDO_CERRADO', estado: pedido.estado });
      }
    }

    return next();
  } catch (err) {
    console.error('[ensureIntentActive] error', err);
    return res.status(500).json({ error: 'INTENT_CHECK_FAILED' });
  }
};
