// backend-facturacion/src/routes/psp.culqi.js
const express = require('express');
const router = express.Router();

const CULQI_API = 'https://api.culqi.com/v2';
const SECRET = process.env.CULQI_SECRET;

if (!global.fetch) {
  // si usas Node < 18, instala node-fetch y descomenta:
  // global.fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));
}

function authHeaders() {
  if (!SECRET) throw new Error('Falta CULQI_SECRET en .env');
  return {
    'Authorization': `Bearer ${SECRET}`,
    'Content-Type': 'application/json'
  };
}

/**
 * POST /psp/culqi/orders
 * body: { amount, currency, customer_email?, metadata }
 */
router.post('/psp/culqi/orders', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const { amount, currency = 'PEN', customer_email = '', metadata = {} } = req.body;
    if (!amount) throw new Error('amount requerido');

    const payload = {
      amount,                         // céntimos
      currency_code: currency,        // "PEN"
      description: 'Pedido restaurante',
      order_number: String(metadata.orderId || Date.now()),
      client_details: { email: customer_email },
      metadata                         // <<<<<< AQUI VA TU METADATA
    };

    const r = await fetch(`${CULQI_API}/orders`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json?.user_message || json?.merchant_message || 'Error creando Order');
    res.json(json);
  } catch (e) {
    console.error('culqi/orders error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /psp/culqi/charges
 * body: { amount, currency, email, token_id, metadata }
 */
router.post('/psp/culqi/charges', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const { amount, currency = 'PEN', email, token_id, metadata = {} } = req.body;
    if (!amount || !token_id || !email) throw new Error('amount, token_id y email requeridos');

    const payload = {
      amount,                         // céntimos
      currency_code: currency,        // "PEN"
      email,
      source_id: token_id,            // token del Checkout
      metadata                        // <<<<<< AQUI TAMBIEN
    };

    const r = await fetch(`${CULQI_API}/charges`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await r.json();
    if (!r.ok) throw new Error(json?.user_message || json?.merchant_message || 'Error creando Charge');
    res.json(json);
  } catch (e) {
    console.error('culqi/charges error:', e.message);
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
