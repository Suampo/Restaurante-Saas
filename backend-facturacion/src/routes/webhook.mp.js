// backend-facturacion/src/routes/webhook.mp.js
const express = require('express');
const router = express.Router();

const APISPERU_BASE = process.env.APISPERU_BASE || 'https://facturacion.apisperu.com/api/v1';
const CPE_BUCKET = process.env.CPE_BUCKET || 'cpe';

const { supabase } = require('../services/supabase');
const { reservarCorrelativo } = require('../services/series');
const { emitirInvoice, getEmisorByRestaurant } = require('../services/facturador');
const { getPedidoCompleto, buildCPE, nowLimaISO } = require('../services/cpe');

let MPConfig, Payment, MerchantOrder;
try {
  const mp = require('mercadopago');
  MPConfig = mp.MercadoPagoConfig;
  Payment = mp.Payment;
  MerchantOrder = mp.MerchantOrder;
} catch (e) {
  console.error('[mercadopago] Falta dependencia. Instala: npm i mercadopago');
  throw e;
}

/* -------------------- helpers -------------------- */
async function getMpAccessTokenForRestaurant(restaurantId) {
  if (!restaurantId) return (process.env.MP_ACCESS_TOKEN || '').trim();
  try {
    const { data } = await supabase
      .from('psp_credentials')
      .select('secret_key')
      .eq('restaurant_id', Number(restaurantId))
      .eq('provider', 'mercadopago')
      .eq('active', true)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const fromDb = (data?.secret_key || '').trim();
    return fromDb || (process.env.MP_ACCESS_TOKEN || '').trim();
  } catch {
    return (process.env.MP_ACCESS_TOKEN || '').trim();
  }
}

async function uploadPublic(path, buffer, contentType) {
  const { error } = await supabase.storage.from(CPE_BUCKET).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(CPE_BUCKET).getPublicUrl(path);
  return pub?.publicUrl || null;
}

async function makePdfAndSave({ restaurantId, rawRequest, serie, correlativo }) {
  const emisor = await getEmisorByRestaurant(restaurantId);
  const token = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();
  const r = await fetch(`${APISPERU_BASE}/invoice/pdf`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/pdf' },
    body: JSON.stringify(rawRequest),
  });
  if (!r.ok) return null;
  const buf = Buffer.from(await r.arrayBuffer());
  const filename = `${emisor.ruc}/${serie}-${String(correlativo).padStart(8, '0')}.pdf`;
  return await uploadPublic(filename, buf, 'application/pdf');
}

async function guardarReciboSimplePDF({ restaurantId, pedido, amountOverride = null }) {
  try {
    let puppeteer = null;
    try { puppeteer = require('puppeteer'); } catch {}
    const total = Number(amountOverride ?? pedido?.total ?? 0);
    const html = `
      <html><head><meta charset="utf-8"><style>
        body{font-family:Arial,sans-serif;padding:20px}
        .box{border:1px solid #eee;border-radius:10px;padding:16px}
        h1{margin:0 0 8px 0;font-size:18px}
        .muted{color:#555;font-size:12px}
        table{width:100%;border-collapse:collapse;margin-top:12px}
        th,td{border-bottom:1px solid #eee;padding:8px;text-align:left}
        .right{text-align:right}
      </style></head><body>
      <div class="box">
        <h1>RECIBO SIMPLE (NO TRIBUTARIO)</h1>
        <div class="muted">Restaurante #${restaurantId}</div>
        <div class="muted">Pedido #${pedido?.id ?? ''} — ${new Date().toLocaleString('es-PE')}</div>
        <table>
          <tr><th>Descripción</th><th class="right">Importe</th></tr>
          <tr><td>Consumo</td><td class="right">S/ ${total.toFixed(2)}</td></tr>
          <tr><td class="right"><b>Total</b></td><td class="right"><b>S/ ${total.toFixed(2)}</b></td></tr>
        </table>
        <p class="muted">Este comprobante no tiene validez tributaria.</p>
      </div></body></html>`;
    let pdfBuf = Buffer.from(html, 'utf8'), contentType = 'text/html';
    if (puppeteer) {
      const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox','--disable-setuid-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      pdfBuf = await page.pdf({ format: 'A4', printBackground: true });
      contentType = 'application/pdf';
      await browser.close();
    }
    const key = `${restaurantId}/RS-${pedido?.id}.pdf`;
    const url = await uploadPublic(key, pdfBuf, contentType);
    await supabase.from('cpe_documents').insert([{
      restaurant_id: restaurantId,
      pedido_id: pedido?.id ?? null,
      tipo_doc: '00',
      estado: 'INTERNO',
      pdf_url: url,
      subtotal: total,
      igv: 0,
      total,
      raw_request: { simple: true },
      raw_response: { note: 'Recibo simple generado' }
    }]);
  } catch (e) {
    console.warn('[recibo simple] no se pudo generar:', e.message || e);
  }
}

/* ====== NUEVO: helpers para intents ====== */
function isUUIDv4Like(s) {
  return typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

/** Crea pedido desde checkout_intents si está 'pending' y devuelve pedidoId */
async function ensurePedidoFromIntent(intentId, payment) {
  try {
    const { data: intent } = await supabase
      .from('checkout_intents').select('*').eq('id', String(intentId)).maybeSingle();
    if (!intent) return null;
    if (intent.status !== 'pending') return intent.pedido_id || null;

    // Obtenemos restaurant_id (int) desde la mesa
    const { data: mesa } = await supabase
      .from('mesas').select('restaurant_id').eq('id', intent.mesa_id).maybeSingle();
    const restaurantIdInt = Number(mesa?.restaurant_id || 0) || null;

    // Insert del pedido (ajusta columnas si tu tabla lo requiere)
    const ins = await supabase
      .from('pedidos')
      .insert([{
        restaurant_id: restaurantIdInt,          // entero
        mesa_id: intent.mesa_id,
        total: Number(intent.amount),
        estado: 'pendiente',                     // <— ya NO lo marcamos pagado aquí
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select('id')
      .maybeSingle();

    const pedidoId = ins?.data?.id;
    if (!pedidoId) return null;

    await supabase
      .from('checkout_intents')
      .update({ status: 'approved', pedido_id: pedidoId, updated_at: new Date().toISOString() })
      .eq('id', String(intentId))
      .eq('status', 'pending');

    return pedidoId;
  } catch (e) {
    console.error('[ensurePedidoFromIntent] error', e);
    return null;
  }
}

/* ====== NUEVO: recompute del estado y emisión si ya completó ====== */
async function getSaldo(pedidoId) {
  const { data: ped } = await supabase
    .from('pedidos')
    .select('id,total,restaurant_id,estado,cpe_id,comprobante_tipo,billing_client,billing_email')
    .eq('id', Number(pedidoId))
    .maybeSingle();
  if (!ped) throw new Error('Pedido no encontrado');

  const { data: rows } = await supabase
    .from('pagos')
    .select('monto,estado')
    .eq('pedido_id', ped.id);

  const pagado = (rows || [])
    .filter(r => String(r.estado || '').toLowerCase() === 'approved')
    .reduce((s, r) => s + Number(r.monto || 0), 0);

  const pendiente = Math.max(0, Number(ped.total || 0) - pagado);
  return { pedido: ped, pagado, pendiente };
}

async function recomputeAndEmitIfPaid_local(pedidoId) {
  const { pedido, pagado, pendiente } = await getSaldo(pedidoId);
  if (pendiente > 0.01) {
    // sigue parcial
    if (pedido.estado !== 'parcial') {
      await supabase.from('pedidos').update({
        estado: 'parcial',
        updated_at: new Date().toISOString()
      }).eq('id', pedido.id);
    }
    return { ok: true, status: 'partial', pagado, pendiente };
  }

  // marcar pagado si no lo está
  if (pedido.estado !== 'pagado') {
    await supabase.from('pedidos').update({
      estado: 'pagado',
      updated_at: new Date().toISOString()
    }).eq('id', pedido.id);
  }

  const rid = Number(pedido.restaurant_id || 0);
  if (!rid) return { ok: true, status: 'paid', pagado, pendiente: 0 };

  // ¿ya tiene CPE?
  if (pedido.cpe_id) return { ok: true, status: 'paid', pagado, pendiente: 0 };

  // ¿modo de facturación?
  const { data: rinfo } = await supabase
    .from('restaurantes')
    .select('billing_mode')
    .eq('id', rid)
    .maybeSingle();
  const billingMode = rinfo?.billing_mode || 'none';

  // si no es SUNAT → genera Recibo Simple (1 sola vez)
  if (billingMode !== 'sunat') {
    try {
      const { pedido: pedFull } = await getPedidoCompleto(pedidoId);
      await guardarReciboSimplePDF({ restaurantId: rid, pedido: pedFull, amountOverride: pedFull.total });
    } catch (e) {
      console.warn('[recibo simple] warn', e.message);
    }
    return { ok: true, status: 'paid', pagado, pendiente: 0 };
  }

  // === SUNAT ===
  const comprobanteTipo = String(pedido.comprobante_tipo || '03');
  const { pedido: pedFull, detalles } = await getPedidoCompleto(pedidoId);

  // completa billing si faltara
  const billing =
    (pedFull.billing_client && Object.keys(pedFull.billing_client).length > 0)
      ? pedFull.billing_client
      : (() => {
          const email = pedFull.billing_email || '';
          const nombre = 'CLIENTE';
          return (comprobanteTipo === '01')
            ? { tipoDoc: '6', numDoc: '00000000000', rznSocial: nombre, email, direccion: '' }
            : { tipoDoc: '1', numDoc: '00000000', nombres: nombre, apellidos: '', email, direccion: '' };
        })();

  const emisor = await getEmisorByRestaurant(rid);
  const { serie, correlativo } = await reservarCorrelativo(rid, comprobanteTipo);
  const { body: cpeBody, totals } = buildCPE({
    tipoDoc: comprobanteTipo,
    serie,
    correlativo,
    fechaEmisionISO: nowLimaISO(),
    emisor,
    billing,
    detalles,
    pedido: pedFull,
  });

  // pre-inserta CPE
  const { data: cpeIns } = await supabase.from('cpe_documents').insert([{
    restaurant_id: rid,
    pedido_id: pedidoId,
    tipo_doc: comprobanteTipo,
    serie,
    correlativo,
    moneda: 'PEN',
    subtotal: Number(totals?.valorVenta ?? 0),
    igv: Number(totals?.mtoIGV ?? 0),
    total: Number(totals?.mtoImpVenta ?? 0),
    estado: 'PENDIENTE',
    raw_request: cpeBody,
    client: billing,
  }]).select('id').maybeSingle();
  const cpeId = cpeIns?.id;

  // emite
  let resp;
  try {
    resp = await emitirInvoice({ restaurantId: rid, cpeBody });
  } catch (e) {
    resp = { error: { message: e?.message || String(e) } };
  }

  const success =
    resp?.accepted || resp?.sunat_response?.success || resp?.sunatResponse?.success || !!resp?.cdrZip;
  const hasError =
    !!(resp?.error || resp?.sunat_response?.error || resp?.sunatResponse?.error);
  const estado = success ? 'ACEPTADO' : (hasError ? 'RECHAZADO' : 'ENVIADO');
  const notas =
    (resp?.sunatResponse?.error?.message) ||
    (resp?.sunat_response?.error?.message) ||
    (resp?.error?.message) || null;

  // artefactos
  let pdf_url = null, xml_url = null, cdr_url = null;
  try {
    const base = `${emisor.ruc}/${serie}-${String(correlativo).padStart(8,'0')}`;

    try {
      pdf_url = await makePdfAndSave({ restaurantId: rid, rawRequest: cpeBody, serie, correlativo });
    } catch (e) { console.warn('[PDF] warn', e.message); }

    const b64xml = resp?.data?.xmlZipBase64 || resp?.xmlZipBase64 || resp?.xml;
    if (b64xml) {
      const buf = Buffer.from(b64xml, 'base64');
      xml_url = await uploadPublic(`${base}.zip`, buf, 'application/zip');
    }
    const b64cdr = resp?.data?.cdrZipBase64 || resp?.cdrZipBase64 || resp?.cdrZip;
    if (b64cdr) {
      const buf = Buffer.from(b64cdr, 'base64');
      cdr_url = await uploadPublic(`${base}-cdr.zip`, buf, 'application/zip');
    }
  } catch (e) {
    console.warn('[artifacts] warn', e.message);
  }

  await supabase.from('cpe_documents').update({
    estado,
    xml_url,
    pdf_url,
    cdr_url,
    hash: resp?.hash || resp?.digestValue || null,
    digest: resp?.digestValue || resp?.hash || null,
    sunat_ticket: resp?.ticket || null,
    sunat_notas: notas,
    raw_response: resp
  }).eq('id', cpeId);

  await supabase.from('pedidos').update({ cpe_id: cpeId, sunat_estado: estado }).eq('id', pedidoId);

  return { ok: true, status: 'paid', pagado, pendiente: 0, cpeId, estado };
}

/* -------------------- endpoint -------------------- */
router.all('/webhooks/mp', (req, res, next) => {
  console.log('[mp webhook] hit', req.method, req.url, 'ua=', req.headers['user-agent'] || '');
  next();
});
router.get('/webhooks/mp', (req, res) => res.status(200).json({ ok: true }));
router.head('/webhooks/mp', (req, res) => res.sendStatus(200));

router.post('/webhooks/mp', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const payload = req.body || {};
    const rawType = payload.type || payload.action || '';
    const type = String(rawType).toLowerCase();
    if (!type.includes('payment')) return res.sendStatus(200);

    const dataId =
      payload?.data?.id ||
      (payload?.resource ? String(payload.resource).split('/').pop() : null);
    if (!dataId) return res.sendStatus(200);

    const restaurantIdFromQuery = Number(req.query.restaurantId || 0) || null;
    const token1 = await getMpAccessTokenForRestaurant(restaurantIdFromQuery);
    const mp1 = new MPConfig({ accessToken: token1 });

    // Lee el pago
    let payment;
    try {
      payment = await new Payment(mp1).get({ id: dataId });
    } catch (e) {
      console.error('[mp] Payment.get fallo con token1', e?.status || e?.response?.status, e?.message);
      const tokenEnv = (process.env.MP_ACCESS_TOKEN || '').trim();
      if (!tokenEnv || tokenEnv === token1) return res.sendStatus(200);
      try {
        payment = await new Payment(new MPConfig({ accessToken: tokenEnv })).get({ id: dataId });
      } catch (e2) {
        console.error('[mp] Payment.get fallo con token env', e2?.status || e2?.response?.status, e2?.message);
        return res.sendStatus(200);
      }
    }

    const status = payment?.status;

    // (1) intenta pedidoId clásico
    let pedidoId =
      Number(payment?.metadata?.pedidoId || payment?.metadata?.pedido_id || 0) ||
      (payment?.external_reference ? Number(payment.external_reference) : null);

    // (2) si no hay pedidoId pero external_reference es uuid y está aprobado → crea pedido desde intent
    const intentId = payment?.external_reference;
    if (!pedidoId && isUUIDv4Like(intentId) && status === 'approved') {
      pedidoId = await ensurePedidoFromIntent(intentId, payment);
    }

    const orderId = payment?.order?.id || null;

    // fallback de restaurantId si no vino en la URL
    const restaurantId =
      restaurantIdFromQuery ||
      Number(payment?.metadata?.restaurantId || payment?.metadata?.restaurant_id || 0) ||
      null;

    console.log('[mp payment]', {
      id: String(payment?.id || dataId),
      status,
      pedidoId,
      orderId,
      restaurantIdHint: restaurantId,
      external_reference: intentId
    });

    // log mínimo del pago
    try {
      await supabase.from('pagos').insert([{
        pedido_id: pedidoId || null,
        psp: 'mp',
        psp_event_id: String(payment?.id || dataId),
        psp_order_id: String(orderId || ''),
        restaurant_id: restaurantId,
        metodo: payment?.payment_method_id || null,
        estado: status || null,
        currency: payment?.currency_id || 'PEN',
        monto: payment?.transaction_amount ?? null,
        psp_payload: payment || null,
      }]);
    } catch {}

    // Si aún no hay pedidoId o no está aprobado → salir
    if (status !== 'approved' || !pedidoId) return res.sendStatus(200);

    // ===== NUEVO: en vez de marcar 'pagado' y emitir aquí, recomputamos =====
    try {
      // si exportaste la función desde split.payments.js, úsala:
      let handled = false;
      try {
        const split = require('./split.payments.js');
        if (split && typeof split.recomputeAndEmitIfPaid === 'function') {
          await split.recomputeAndEmitIfPaid(pedidoId);
          handled = true;
        }
      } catch {}
      if (!handled) {
        await recomputeAndEmitIfPaid_local(pedidoId);
      }
    } catch (e) {
      console.warn('[split recompute] warn:', e?.message || e);
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('[webhook.mp] err:', err?.message || err);
    return res.sendStatus(200); // evitar reintentos masivos
  }
});

module.exports = router;
