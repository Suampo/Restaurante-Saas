// backend-pasarela/src/routes/psp.mercadopago.js
import express from 'express';
import axios from 'axios';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import { supabase } from '../services/supabase.js';
import { getMpKeysForRestaurant } from '../services/mpKeys.js';

const router = express.Router();

/* ===== Utilitarios ===== */
const _inFlight = new Set();
async function oncePerPayment(paymentId, fn) {
  const key = String(paymentId);
  if (_inFlight.has(key)) return false;
  _inFlight.add(key);
  try {
    await fn();
  } finally {
    setTimeout(() => _inFlight.delete(key), 15000);
  }
  return true;
}

const env = (k, def = '') => (process.env[k] ?? def).toString().trim();

// Token CSRF interno para llamar a backend-facturación
const INTERNAL_CSRF_TOKEN =
  (process.env.INTERNAL_CSRF_TOKEN || 'internal-csrf-bridge').trim();

function getURLs() {
  const port = env('PORT', '5500');
  return {
    frontendUrl  : env('FRONTEND_URL', 'http://localhost:5173'),
    baseUrl      : env('BASE_URL', `http://localhost:${port}`),
    factApiUrl   : env('FACT_API_URL', 'http://localhost:5000'),
    factBaseUrl  : env('FACT_BASE_URL', ''),
    pedidosApiUrl: env('PEDIDOS_API_URL', ''),
  };
}

/**
 * URL del webhook de MP (MULTITENANT)
 * - Para cada restaurante construimos:  .../api/psp/mp/webhook/r/:restaurantId
 * - Así el webhook sabe qué credenciales leer de psp_credentials.
 */
function buildWebhookUrl(restaurantId) {
  const rid = Number(restaurantId || 0);
  const forced = (process.env.MP_WEBHOOK_URL || '').trim();

  // Ej: MP_WEBHOOK_URL=https://api-pasarela.mikhunappfood.com/api/psp/mp/webhook
  if (forced) {
    return rid > 0
      ? `${forced.replace(/\/+$/, '')}/r/${rid}` // ➜ /webhook/r/1
      : forced;
  }

  const { baseUrl } = getURLs();
  const base = baseUrl.replace(/\/+$/, '');

  // fallback local dev
  return rid > 0
    ? `${base}/api/psp/mp/webhook/r/${rid}`
    : `${base}/api/psp/mp/webhook`;
}

/**
 * Crea cliente de MP para UN restaurante específico (multitenant)
 * - Lee accessToken desde Supabase.psp_credentials por restaurant_id.
 */
async function getMPForRestaurant(restaurantId) {
  const { accessToken } = await getMpKeysForRestaurant(restaurantId);
  if (!accessToken || accessToken.length < 30) {
    const e = new Error('[mp] Access token vacío/invalid (DB/.env)');
    e.status = 500;
    throw e;
  }
  return new MercadoPagoConfig({ accessToken });
}

/* ===== Helpers extra para calidad de integración ===== */
function splitName(full = '') {
  const parts = String(full).trim().split(/\s+/);
  if (!parts.length) return { first_name: '', last_name: '' };
  if (parts.length === 1) return { first_name: parts[0], last_name: '' };
  return { first_name: parts[0], last_name: parts.slice(1).join(' ') };
}

// Tomamos el Device ID enviado por el frontend (MP.js v2)
// y se lo pasamos a MP vía header recomendado.
function mpHeadersFromReq(req) {
  const deviceId =
    req.get('X-Device-Session-Id') ||
    req.get('X-Device-Id') ||
    req.get('X-meli-session-id') ||
    null;
  return deviceId ? { 'X-meli-session-id': deviceId } : undefined;
}

const MP_STATEMENT_DESCRIPTOR =
  (process.env.MP_STATEMENT_DESCRIPTOR || '').trim() || undefined;

const MP_BINARY_MODE = /^(1|true)$/i.test(process.env.MP_BINARY_MODE || '');

/* ====== Notificación a backend-facturación ====== */
async function notifyPaid({ pedidoId, payment }) {
  const { factBaseUrl, factApiUrl } = getURLs();
  const base = (factBaseUrl || factApiUrl || '').replace(/\/+$/, '');
  if (!base) return;

  const url = `${base}/api/pedidos/${Number(pedidoId)}/pagado`;

  // Campos tomados del Payment de MP
  const eventId  = String(payment?.id || '');
  const chargeId = String(payment?.id || '');
  const orderId  = payment?.order?.id ?? payment?.merchant_order_id ?? null;
  const approved = payment?.date_approved || null;

  const body = {
    amount      : Number(payment?.transaction_amount || 0),
    pasarela    : 'mercado_pago',
    payment_id  : eventId, // compat
    method      : payment?.payment_method_id || 'mp',
    status      : payment?.status || null,

    // claves de reconciliación
    psp_event_id : eventId, // id del Payment
    psp_charge_id: chargeId,
    psp_order_id : orderId ? String(orderId) : null,
    approved_at  : approved,

    // snapshot completo para auditoría
    mp_snapshot: payment,
  };

  const csrf = INTERNAL_CSRF_TOKEN || 'internal-csrf-bridge';

  try {
    await axios.post(url, body, {
      timeout: 20000,
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
        // Cookie para que el middleware requireCsrf de facturación pase:
        // cookie "csrf_token" = header "x-csrf-token"
        Cookie: `csrf_token=${csrf}`,
      },
    });
  } catch (e) {
    console.warn(
      '[notifyPaid] fallo:',
      e?.response?.status,
      e?.message,
      e?.response?.data || '',
    );
  }
}

/* ===== Rutas ===== */

/* -- Preferencias (Wallet/Checkout Pro) -- */
router.post('/psp/mp/preferences', async (req, res) => {
  try {
    const {
      sku,
      quantity = 1,
      title,
      unit_price,
      currency_id = 'PEN',
      buyerEmail,
      metadata = {},
      walletOnly = true,
    } = req.body || {};

    if (!title || unit_price == null) {
      return res
        .status(400)
        .json({ error: 'Faltan campos: title, unit_price' });
    }

    const restaurantId = Number(
      metadata?.restaurantId || req.query.restaurantId || 0,
    );
    const mp = await getMPForRestaurant(restaurantId);
    const { frontendUrl } = getURLs();

    const body = {
      items: [
        {
          id         : sku || 'SKU-1',
          title      : String(title),
          description: String(title),
          category_id: 'others',
          quantity   : Math.max(1, parseInt(quantity, 10) || 1),
          unit_price : Number(unit_price),
          currency_id,
        },
      ],
      payer: buyerEmail ? { email: String(buyerEmail) } : undefined,
      back_urls: {
        success: `${frontendUrl}/checkout/success`,
        failure: `${frontendUrl}/checkout/failure`,
        pending: `${frontendUrl}/checkout/pending`,
      },
      notification_url : buildWebhookUrl(restaurantId),
      metadata         : { sku, ...metadata, restaurantId },
      external_reference: String(metadata?.pedidoId || ''),
      ...(walletOnly ? { purpose: 'wallet_purchase' } : {}),
      ...(MP_STATEMENT_DESCRIPTOR
        ? { statement_descriptor: MP_STATEMENT_DESCRIPTOR }
        : {}),
    };

    const idem =
      req.get('X-Idempotency-Key') ||
      req.get('x-idempotency-key') ||
      String(
        metadata?.intentId ||
          metadata?.pedidoId ||
          Date.now(),
      );

    const pref = new Preference(mp);
    const resp = await pref.create(
      { body },
      { idempotencyKey: idem, headers: mpHeadersFromReq(req) },
    );
    return res.status(201).json({ preferenceId: resp.id });
  } catch (err) {
    const status = err?.status || err?.response?.status || 500;
    const data =
      err?.cause || err?.response?.data || { error: err.message };
    console.error(
      '[/psp/mp/preferences] status=',
      status,
      'data=',
      JSON.stringify(data),
    );
    return res.status(status).json(data);
  }
});

/* -- Helper para sunat_estado (por si lo usas luego) -- */
async function setPedidoSunatEstado(pedidoId, estado) {
  try {
    if (!pedidoId) return;
    await supabase
      .from('pedidos')
      .update({ sunat_estado: estado || null })
      .eq('id', Number(pedidoId));
  } catch (e) {
    console.warn(
      '[mp webhook] no se pudo actualizar sunat_estado:',
      e?.message || e,
    );
  }
}

/* -- Webhook Mercado Pago (MULTITENANT con /r/:restaurantId) -- */
router.post(
  [
    '/psp/mp/webhook',
    '/psp/mp/webhook/r/:restaurantId',
    '/webhooks/mp',
    '/webhooks/mp/r/:restaurantId',
  ],
  async (req, res) => {
    try {
      const payload = req.body || {};
      const type = payload.type || payload.action;
      const dataId =
        payload?.data?.id ||
        (payload?.resource
          ? String(payload.resource).split('/').pop()
          : null);

      // restaurantId puede venir por la ruta (/r/:restaurantId)
      // o como query param (por compatibilidad)
      const restaurantIdHint = Number(
        req.params.restaurantId || req.query.restaurantId || 0,
      );

      if (!type || !dataId) {
        return res.sendStatus(200);
      }

      if (!restaurantIdHint) {
        console.warn(
          '[mp webhook] restaurantIdHint vacío; revisa buildWebhookUrl / MP_WEBHOOK_URL',
        );
        return res.sendStatus(200);
      }

      if (String(type).toLowerCase().includes('payment')) {
        const mp = await getMPForRestaurant(restaurantIdHint);
        const payment = await new Payment(mp).get({ id: dataId });

        const pedidoId =
          payment?.metadata?.pedidoId ??
          (payment?.external_reference
            ? Number(payment.external_reference)
            : null);

        const orderId =
          payment?.order?.id ?? payment?.merchant_order_id ?? null;

        console.log('[mp payment]', {
          id               : String(payment.id),
          status           : payment.status,
          status_detail    : payment.status_detail,
          payment_method_id: payment.payment_method_id,
          pedidoId,
          orderId,
          restaurantIdHint,
        });

        if (payment.status === 'approved' && pedidoId) {
          await oncePerPayment(payment.id, () =>
            notifyPaid({ pedidoId, payment }),
          );
        }
      }

      return res.sendStatus(200);
    } catch (err) {
      console.error('[mp webhook err]', err?.message || err);
      // 200 para que MP no reintente infinito si el error es nuestro
      return res.sendStatus(200);
    }
  },
);

/* -- Pago con Yape -- */
async function handleYape(req, res) {
  try {
    const { token, amount, email, description, metadata = {} } =
      req.body || {};
    if (!token)
      return res.status(400).json({ error: 'token requerido (Yape)' });

    const amt = Math.round(Number(amount) * 100) / 100;
    if (!(amt > 0))
      return res.status(400).json({ error: 'amount inválido' });

    const restaurantId = Number(
      metadata.restaurantId || req.query.restaurantId || 0,
    );
    const mp = await getMPForRestaurant(restaurantId);
    const notifyUrl = buildWebhookUrl(restaurantId);
    const idem =
      req.get('X-Idempotency-Key') ||
      req.get('x-idempotency-key') ||
      String(
        metadata?.intentId ||
          metadata?.pedidoId ||
          Date.now(),
      );

    const body = {
      token,
      transaction_amount: amt,
      installments      : 1,
      payment_method_id : 'yape',
      payer: {
        email:
          (email || '').trim() ||
          `yape+${Date.now()}@example.com`,
      }, // requerido en live
      description      : description || 'Pago con Yape',
      metadata         : { ...metadata, restaurantId },
      external_reference: String(metadata?.pedidoId || ''),
      notification_url  : notifyUrl,
      ...(MP_STATEMENT_DESCRIPTOR
        ? { statement_descriptor: MP_STATEMENT_DESCRIPTOR }
        : {}),
      ...(MP_BINARY_MODE ? { binary_mode: true } : {}),
    };

    const payment = await new Payment(mp).create(
      { body },
      { idempotencyKey: idem, headers: mpHeadersFromReq(req) },
    );
    return res.status(201).json({
      id           : payment.id,
      status       : payment.status,
      status_detail: payment.status_detail,
    });
  } catch (err) {
    const status = err?.status || err?.response?.status || 500;
    const data =
      err?.cause || err?.response?.data || { error: err.message };
    console.error(
      '[/psp/mp/payments/yape] status=',
      status,
      'data=',
      JSON.stringify(data),
    );
    return res.status(status).json(data);
  }
}
router.post('/psp/mp/payments/yape', handleYape);
router.post('/psp/mp/yape', handleYape); // alias

/* -- Pago con Tarjeta (Brick) -- */
async function handleCard(req, res) {
  try {
    const { formData, amount, description, metadata = {} } =
      req.body || {};
    if (!formData?.token)
      return res
        .status(400)
        .json({ error: 'token requerido (tarjeta)' });

    const amt = Math.round(Number(amount) * 100) / 100;
    if (!(amt > 0))
      return res.status(400).json({ error: 'amount inválido' });

    const restaurantId = Number(
      metadata.restaurantId || req.query.restaurantId || 0,
    );
    const mp = await getMPForRestaurant(restaurantId);
    const notifyUrl = buildWebhookUrl(restaurantId);
    const idem =
      req.get('X-Idempotency-Key') ||
      req.get('x-idempotency-key') ||
      String(
        metadata?.intentId ||
          metadata?.pedidoId ||
          Date.now(),
      );

    // Enriquecemos payer si viene por metadata (opcional)
    const nameFromMeta = metadata?.buyer_name || '';
    const { first_name, last_name } = splitName(nameFromMeta);

    const body = {
      token             : formData.token,
      transaction_amount: amt,
      installments      : Number(formData.installments || 1),
      payment_method_id : formData.payment_method_id,
      issuer_id         : formData.issuer_id, // recomendado
      payer: {
        email         : formData?.payer?.email,
        identification: formData?.payer?.identification,
        ...(first_name ? { first_name } : {}),
        ...(last_name ? { last_name } : {}),
      },
      description      : description || 'Pago con tarjeta',
      metadata         : { ...metadata, restaurantId },
      external_reference: String(metadata?.pedidoId || ''),
      notification_url  : notifyUrl,
      ...(MP_STATEMENT_DESCRIPTOR
        ? { statement_descriptor: MP_STATEMENT_DESCRIPTOR }
        : {}),
      ...(MP_BINARY_MODE ? { binary_mode: true } : {}),
    };

    const payment = await new Payment(mp).create(
      { body },
      { idempotencyKey: idem, headers: mpHeadersFromReq(req) },
    );
    return res.status(201).json({
      id           : payment.id,
      status       : payment.status,
      status_detail: payment.status_detail,
    });
  } catch (err) {
    const status = err?.status || err?.response?.status || 500;
    const data =
      err?.cause || err?.response?.data || { error: err.message };
    console.error(
      '[/psp/mp/payments/card] status=',
      status,
      'data=',
      JSON.stringify(data),
    );
    return res.status(status).json(data);
  }
}
router.post('/psp/mp/payments/card', handleCard);
router.post('/psp/mp/card', handleCard); // alias

export default router;
