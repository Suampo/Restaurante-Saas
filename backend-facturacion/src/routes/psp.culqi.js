// backend-facturacion/src/routes/psp.culqi.js
const express = require('express');
const router = express.Router();

const CULQI_API = 'https://api.culqi.com/v2';
const SECRET = process.env.CULQI_SECRET;

if (!global.fetch) {
  // Si usas Node < 18, instala node-fetch e impórtalo aquí.
  // global.fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
}

function authHeaders() {
  if (!SECRET) throw new Error('Falta CULQI_SECRET en .env');
  return {
    'Authorization': `Bearer ${SECRET}`,
    'Content-Type': 'application/json'
  };
}

router.use(express.json({ type: '*/*' }));

/**
 * POST /psp/culqi/orders
 * body: { amount, currency?, email?, customer_email?, description?, paymentMethods?, metadata? }
 */
router.post('/psp/culqi/orders', async (req, res) => {
  try {
    const {
      amount,
      currency = 'PEN',
      email,
      customer_email,
      description = 'Pedido restaurante',
      paymentMethods, // no lo necesita Culqi aquí; lo dejamos por compatibilidad
      metadata = {}
    } = req.body;

    if (!amount) throw new Error('amount requerido');
    const clientEmail = customer_email || email || '';

    const payload = {
      amount,                         // céntimos
      currency_code: currency,        // "PEN"
      description,
      order_number: String(metadata.orderId || Date.now()),
      client_details: { email: clientEmail },
      metadata                        // << pasa TODO tu metadata
    };

    const r = await fetch(`${CULQI_API}/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) {
      // Este es el mensaje que te estaba saliendo:
      // "El comercio tiene problemas de integración..."
      throw new Error(json?.user_message || json?.merchant_message || 'Error creando Order');
    }
    // Devuelvo un envoltorio amigable para el front
    res.json({ culqi: { orderId: json?.id || null }, raw: json });
  } catch (e) {
    console.error('culqi/orders error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /psp/culqi/charges
 * body: { amount, currency?, email, tokenId?, token_id?, description?, metadata? }
 */
router.post('/psp/culqi/charges', async (req, res) => {
  try {
    const {
      amount,
      currency = 'PEN',
      email,
      tokenId,
      token_id,
      description = 'Pedido restaurante',
      metadata = {}
    } = req.body;

    const source = token_id || tokenId;
    if (!amount || !source || !email) throw new Error('amount, tokenId y email requeridos');

    const payload = {
      amount,                         // céntimos
      currency_code: currency,        // "PEN"
      email,
      source_id: source,              // token del Checkout
      description,
      metadata                        // << pasa TODO tu metadata
    };

    const r = await fetch(`${CULQI_API}/charges`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) {
      throw new Error(json?.user_message || json?.merchant_message || 'Error creando Charge');
    }
    res.json({ culqi: { id: json?.id || null }, raw: json });
  } catch (e) {
    console.error('culqi/charges error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
