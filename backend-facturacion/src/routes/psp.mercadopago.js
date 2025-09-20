// backend-facturacion/src/routes/psp.mercadopago.js
const express = require('express');
const router = express.Router();

let MPConfig, Preference, Payment;
try {
  const mp = require('mercadopago');
  MPConfig = mp.MercadoPagoConfig;
  Preference = mp.Preference;
  Payment = mp.Payment;
} catch (e) {
  console.error('[mercadopago] no instalado. Ejecuta: npm i mercadopago');
  throw e;
}

function getKeys() {
  return {
    publicKey: process.env.MP_PUBLIC_KEY,
    accessToken: process.env.MP_ACCESS_TOKEN,
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`,
    webhookUrl: (process.env.MP_WEBHOOK_URL || '').trim(), // opcional: forzar webhook externo
  };
}

function buildWebhookUrl(restaurantId) {
  const { baseUrl, webhookUrl } = getKeys();
  const urlBase = (webhookUrl || `${baseUrl.replace(/\/+$/, '')}/webhooks/mp`).trim();
  return restaurantId ? `${urlBase}?restaurantId=${restaurantId}` : urlBase;
}

/* --- Public Key --- */
router.get('/psp/mp/public-key', async (_req, res) => {
  const { publicKey } = getKeys();
  if (!publicKey) return res.status(500).json({ error: 'MP_PUBLIC_KEY no configurado' });
  res.json({ publicKey });
});

/* --- Preferencias (Wallet/CheckoutPro) --- */
router.post('/psp/mp/preferences', async (req, res) => {
  try {
    const { accessToken, frontendUrl } = getKeys();
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const {
      title,
      unit_price,
      currency_id = 'PEN',
      quantity = 1,
      buyerEmail,
      metadata = {},
      idempotencyKey,
    } = req.body || {};
    if (!title || unit_price == null) return res.status(400).json({ error: 'Faltan campos: title, unit_price' });

    const restaurantId = Number(metadata?.restaurantId || req.query.restaurantId || 0);
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
        notification_url: buildWebhookUrl(restaurantId),
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

/* --- Card Brick: handler extraído (idempotencia reforzada) --- */
async function handleCardPayment(req, res) {
  try {
    const { accessToken } = getKeys();
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const { amount, formData, description, metadata = {} } = req.body || {};
    if (!amount || !formData?.token) {
      return res.status(400).json({ error: 'Faltan amount o formData.token' });
    }

    const intentId = metadata?.intentId;
    const pedidoId = metadata?.pedidoId;
    const restaurantId = Number(metadata?.restaurantId || req.query.restaurantId || 0);

    const mp = new MPConfig({ accessToken });
    const payment = new Payment(mp);

    const idemHeader =
      req.get('X-Idempotency-Key') ||
      String(intentId || pedidoId || Date.now());

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
      metadata: { ...metadata, restaurantId },
      notification_url: buildWebhookUrl(restaurantId),
    };

    const resp = await payment.create({
      body: payload,
      requestOptions: {
        idempotencyKey: idemHeader,
        headers: { 'X-Idempotency-Key': idemHeader },
      },
    });

    return res.json({
      id: resp.id,
      status: resp.status,
      status_detail: resp.status_detail,
    });
  } catch (err) {
    console.error('[/psp/mp/payments/card] error:', err?.message || err);
    const status = err?.status || err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
}

// Registra ambos endpoints con el mismo handler
router.post('/psp/mp/payments/card', handleCardPayment);
router.post('/psp/mp/card', handleCardPayment);

/* --- Yape (tokenizado) con alias opcional --- */
async function handleYapePayment(req, res) {
  try {
    const { accessToken } = getKeys();
    if (!accessToken) return res.status(400).json({ error: 'MP_ACCESS_TOKEN no configurado' });

    const { token, amount, email, description, metadata = {} } = req.body || {};
    if (!token || !amount) {
      return res.status(400).json({ error: 'Falta token o amount' });
    }

    const intentId = metadata?.intentId;
    const pedidoId = metadata?.pedidoId;
    const restaurantId = Number(metadata?.restaurantId || req.query.restaurantId || 0);

    const mp = new MPConfig({ accessToken });
    const payment = new Payment(mp);

    const idemHeader =
      req.get('X-Idempotency-Key') ||
      String(intentId || pedidoId || Date.now());

    const payload = {
      transaction_amount: Number(amount),
      description: description || `Pedido ${pedidoId ?? '-'} / Intent ${intentId ?? '-'}`,
      payment_method_id: 'yape',
      token,
      payer: { email: (email || '').trim() || undefined },
      external_reference: String(pedidoId || intentId || ''),
      metadata: { ...metadata, restaurantId },
      notification_url: buildWebhookUrl(restaurantId),
    };

    const resp = await payment.create({
      body: payload,
      requestOptions: {
        idempotencyKey: idemHeader,
        headers: { 'X-Idempotency-Key': idemHeader },
      },
    });

    return res.json({
      id: resp.id,
      status: resp.status,
      status_detail: resp.status_detail,
    });
  } catch (err) {
    console.error('[/psp/mp/payments/yape] error:', err?.message || err);
    const status = err?.status || err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
}

router.post('/psp/mp/payments/yape', handleYapePayment);
router.post('/psp/mp/yape', handleYapePayment); // alias

module.exports = router;
