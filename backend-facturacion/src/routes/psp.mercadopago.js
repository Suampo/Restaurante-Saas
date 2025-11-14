// backend-facturacion/src/routes/psp.mercadopago.js
const express = require('express');
const router = express.Router();
const ensureIntentActive = require('../middlewares/ensureIntentActive'); // ✅ carpeta singular
const { supabase } = require('../services/supabase');

let MPConfig, Preference, Payment;
try {
  const mp = require('mercadopago');
  MPConfig = mp.MercadoPagoConfig;
  Preference = mp.Preference;
  Payment   = mp.Payment;
} catch (e) {
  console.error('[mercadopago] no instalado. Ejecuta: npm i mercadopago');
  throw e;
}

/* -------------------- Helpers de configuración -------------------- */
function baseEnv() {
  return {
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`).trim(),
    webhookUrl: (process.env.MP_WEBHOOK_URL || '').trim(),
  };
}

/** Obtiene claves para el restaurantId:
 * 1) psp_credentials (mercadopago, active=true)
 * 2) restaurantes (public_key/secret_key)
 * 3) .env (fallback)
 */
async function getKeysAsync(req) {
  const md = req.body?.metadata || {};
  const restaurantId = Number(req.query.restaurantId || md.restaurantId || 0);
  let publicKey = null, accessToken = null, mode = 'test';

  if (restaurantId) {
    // 1) psp_credentials
    const { data: cred } = await supabase
      .from('psp_credentials')
      .select('public_key, secret_key, mode, provider, active')
      .eq('restaurant_id', restaurantId)
      .eq('provider', 'mercadopago')
      .eq('active', true)
      .maybeSingle();

    if (cred?.public_key && cred?.secret_key) {
      publicKey   = cred.public_key;
      accessToken = cred.secret_key;
      mode        = cred.mode || 'test';
    }

    // 2) restaurantes (fallback)
    if (!publicKey || !accessToken) {
      const { data: rest } = await supabase
        .from('restaurantes')
        .select('public_key, secret_key')
        .eq('id', restaurantId)
        .single();

      if (rest?.public_key && rest?.secret_key) {
        publicKey   = publicKey   || rest.public_key;
        accessToken = accessToken || rest.secret_key;
      }
    }
  }

  // 3) .env (fallback final)
  if (!publicKey)   publicKey   = process.env.MP_PUBLIC_KEY   || '';
  if (!accessToken) accessToken = process.env.MP_ACCESS_TOKEN || '';

  return { restaurantId, publicKey, accessToken, mode, ...baseEnv() };
}

function buildWebhookUrl(keys) {
  const { restaurantId, baseUrl, webhookUrl } = keys;
  const urlBase = (webhookUrl || `${baseUrl.replace(/\/+$/, '')}/webhooks/mp`).trim();
  return restaurantId ? `${urlBase}?restaurantId=${restaurantId}` : urlBase;
}

/* -------------------- Rutas -------------------- */

/* --- Public Key para el Brick --- */
router.get('/psp/mp/public-key', async (req, res) => {
  try {
    const { publicKey } = await getKeysAsync(req);
    if (!publicKey) return res.status(500).json({ error: 'MP_PUBLIC_KEY no configurado' });
    res.json({ publicKey });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* --- Preferencias (Checkout Pro / Wallet) --- */
router.post('/psp/mp/preferences', async (req, res) => {
  try {
    const keys = await getKeysAsync(req);
    const { accessToken, frontendUrl, restaurantId } = keys;
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const {
      title, unit_price, currency_id = 'PEN', quantity = 1,
      buyerEmail, metadata = {}, idempotencyKey,
    } = req.body || {};

    if (!title || unit_price == null) {
      return res.status(400).json({ error: 'Faltan campos: title, unit_price' });
    }

    const mp = new MPConfig({ accessToken });
    const pref = new Preference(mp);

    const resp = await pref.create({
      body: {
        items: [{ title, quantity, unit_price: Number(unit_price), currency_id }],
        payer: buyerEmail ? { email: buyerEmail } : undefined,
        back_urls: {
          success: `${frontendUrl}/checkout/success`,
          failure: `${frontendUrl}/checkout/failure`,
          pending: `${frontendUrl}/checkout/pending`,
        },
        auto_return: 'approved',
        notification_url: buildWebhookUrl(keys),
        metadata: { ...metadata, restaurantId },
        external_reference: String(metadata?.pedidoId || ''),
      }
    }, idempotencyKey ? { idempotencyKey } : undefined);

    return res.status(201).json({ preferenceId: resp.id });
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
});

/* --- Card Brick --- */
async function handleCardPayment(req, res) {
  try {
    const keys = await getKeysAsync(req);
    const { accessToken, restaurantId } = keys;
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const { amount, formData, description, metadata = {} } = req.body || {};
    if (!amount || !formData?.token) {
      return res.status(400).json({ error: 'Faltan amount o formData.token' });
    }

    const intentId = metadata?.intentId || req.body?.intentId || null;
    const pedidoId = metadata?.pedidoId;

    const mp = new MPConfig({ accessToken });
    const payment = new Payment(mp);

    const idemHeader = req.get('X-Idempotency-Key') || String(intentId || pedidoId || Date.now());

    const payload = {
      transaction_amount: Number(amount),
      description: description || `Pedido ${pedidoId ?? '-'} / Intent ${intentId ?? '-'}`,
      payment_method_id: formData?.payment_method_id,
      token: formData?.token,
      installments: Number(formData?.installments || 1),
      issuer_id: formData?.issuer_id,
      payer: {
        email: formData?.payer?.email,
        identification: formData?.payer?.identification,
      },
      external_reference: String(pedidoId || intentId || ''),
      metadata: { ...metadata, restaurantId, intentId },
      notification_url: buildWebhookUrl(keys),
    };

    const resp = await payment.create({
      body: payload,
      requestOptions: { idempotencyKey: idemHeader, headers: { 'X-Idempotency-Key': idemHeader } },
    });

    return res.json({ id: resp.id, status: resp.status, status_detail: resp.status_detail });
  } catch (err) {
    console.error('[/psp/mp/payments/card] error:', err?.message || err);
    const status = err?.status || err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
}
router.post('/psp/mp/payments/card', ensureIntentActive, handleCardPayment);
router.post('/psp/mp/card',         ensureIntentActive, handleCardPayment);

/* --- Yape (tokenizado) --- */
async function handleYapePayment(req, res) {
  try {
    const keys = await getKeysAsync(req);
    const { accessToken, restaurantId } = keys;
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const { token, amount, email, description, metadata = {} } = req.body || {};
    if (!token || !amount) return res.status(400).json({ error: 'Falta token o amount' });

    const intentId = metadata?.intentId;
    const pedidoId = metadata?.pedidoId;

    const mp = new MPConfig({ accessToken });
    const payment = new Payment(mp);

    const idemHeader = req.get('X-Idempotency-Key') || String(intentId || pedidoId || Date.now());

    const payload = {
      transaction_amount: Number(amount),
      description: description || `Pedido ${pedidoId ?? '-'} / Intent ${intentId ?? '-'}`,
      payment_method_id: 'yape',
      token,
      payer: { email: (email || '').trim() || undefined },
      external_reference: String(pedidoId || intentId || ''),
      metadata: { ...metadata, restaurantId, intentId },
      notification_url: buildWebhookUrl(keys),
    };

    const resp = await payment.create({
      body: payload,
      requestOptions: { idempotencyKey: idemHeader, headers: { 'X-Idempotency-Key': idemHeader } },
    });

    return res.json({ id: resp.id, status: resp.status, status_detail: resp.status_detail });
  } catch (err) {
    console.error('[/psp/mp/payments/yape] error:', err?.message || err);
    const status = err?.status || err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
}
router.post('/psp/mp/payments/yape', ensureIntentActive, handleYapePayment);
router.post('/psp/mp/yape',          ensureIntentActive, handleYapePayment);

module.exports = router;
