// backend-facturacion/src/routes/culqi.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');
const { reservarCorrelativo } = require('../services/series');
const { emitirInvoice, getEmisorByRestaurant } = require('../services/facturador');
const { getPedidoCompleto, buildCPE, nowLimaISO } = require('../services/cpe');

/* ----------------------------- Helpers ------------------------------ */

// Idempotencia simple por evento PSP
async function alreadyProcessed(pspEventId) {
  if (!pspEventId) return false;
  const { data, error } = await supabase
    .from('pagos')
    .select('id')
    .eq('psp_event_id', pspEventId)
    .limit(1);
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

// Normaliza payload Culqi (v1 y v2)
function parseCulqi(ev) {
  const type = ev?.type || '';
  const status = String(
    ev?.data?.status ||
    ev?.data?.order_status ||
    ev?.data?.additional_info?.status ||
    ''
  ).toLowerCase();

  const isPaid =
    type === 'charge.succeeded' ||
    type === 'charge.creation.succeeded' || // v2 charges
    type === 'order.paid' ||
    (type === 'order.status.changed' && status === 'paid'); // v2 orders

  const amountCents = ev?.data?.amount_in_cents ?? ev?.data?.amount ?? 0;

  return {
    type,
    isPaid,
    amount: Number(amountCents) / 100,
    currency: ev?.data?.currency || ev?.data?.currency_code || 'PEN',
    metadata: ev?.data?.metadata || ev?.metadata || {},
    pspEventId: ev?.id || ev?.event_id || ev?.data?.id || null,
    culqiOrderId: ev?.data?.order_id || null,
    culqiChargeId: ev?.data?.charge_id || ev?.data?.id || null,
    raw: ev,
  };
}

// "01" Factura | "03" Boleta
function resolveComprobanteTipo(md) {
  const byCode = String(md?.comprobanteTipo || '').trim();
  if (byCode === '01' || byCode === '03') return byCode;

  const byAlias = String(md?.cpe_tipo || '').toLowerCase(); // "factura"|"boleta"
  if (byAlias === 'factura') return '01';
  if (byAlias === 'boleta') return '03';

  const docTipo = String(md?.doc_tipo || '').toUpperCase(); // "RUC"|"DNI"
  if (docTipo === 'RUC' || String(md?.doc_numero || '').length === 11) return '01';
  return '03';
}

// Si falta billing_client en el pedido, compónlo desde metadata
function buildBillingFromMetadata(md, tipo) {
  const email = md?.cliente_email || md?.email || '';
  const direccion = md?.cliente_direccion || md?.direccion || '';
  const nombre = (md?.cliente_nombre || '').trim();

  if (tipo === '01') {
    // FACTURA → RUC (6) = 11 dígitos
    const ruc = String(md?.doc_numero || md?.ruc || '').trim();
    if (!/^\d{11}$/.test(ruc)) {
      throw new Error('RUC inválido para factura (11 dígitos requeridos)');
    }
    return { tipoDoc: '6', numDoc: ruc, rznSocial: nombre || 'CLIENTE', email, direccion };
  } else {
    // BOLETA → DNI (1). Si DNI inválido, consumidor final (0).
    const dni = String(md?.doc_numero || md?.dni || '').trim();
    if (/^\d{8}$/.test(dni)) {
      const parts = nombre.split(/\s+/).filter(Boolean);
      const apellidos = parts.length > 1 ? parts.pop() : '';
      const nombres = parts.join(' ') || (nombre || 'CLIENTE');
      return { tipoDoc: '1', numDoc: dni, nombres, apellidos, email, direccion };
    }
    return { tipoDoc: '0', numDoc: '0', nombres: nombre || 'CLIENTE', apellidos: '', email, direccion };
  }
}

/* ------------------------------ Route -------------------------------- */

router.post('/culqi', express.json({ type: '*/*' }), async (req, res) => {
  // Log visible siempre que golpeen el endpoint
  console.log('[WEBHOOK] hit /webhooks/culqi', new Date().toISOString(), 'type=', req.body?.type, 'ua=', req.headers['user-agent'] || '');

  const ev = req.body;
  const norm = parseCulqi(ev);

  // Guarda log del webhook (no interrumpe el flujo si falla)
  try {
    const ins = await supabase.from('webhook_logs').insert({
      payload: norm.raw,
      psp: 'culqi',
      headers: req.headers,
      payload_raw: JSON.stringify(norm.raw),
    });
    if (ins.error) console.error('[WEBHOOK] supabase webhook_logs ERROR:', ins.error.message);
  } catch (e) {
    console.error('[WEBHOOK] webhook_logs THROW:', e.message);
  }

  let cpeId = null;
  let orderId = null;

  try {
    if (!norm.isPaid) {
      return res.status(200).json({ ok: true, ignored: norm.type });
    }
    if (await alreadyProcessed(norm.pspEventId)) {
      return res.status(200).json({ ok: true, duplicated: true });
    }

    // Metadata obligatoria
    const md = norm.metadata || {};
    orderId = Number(md.orderId || md.order_id);
    const restaurantId = Number(md.restaurantId || md.restaurant_id);
    const comprobanteTipo = resolveComprobanteTipo(md);
    if (!orderId || !restaurantId) throw new Error('Falta metadata {orderId, restaurantId}');

    // Monto: si Culqi no envía (0), usa el total del pedido
    let amountForPayment = norm.amount || 0;
    if (!amountForPayment || amountForPayment <= 0) {
      const { data: pedRow, error: ePed } = await supabase
        .from('pedidos')
        .select('total')
        .eq('id', orderId)
        .maybeSingle();
      if (ePed) throw ePed;
      if (pedRow && Number(pedRow.total) > 0) amountForPayment = Number(pedRow.total);
    }

    // 1) Registrar pago + marcar pedido pagado
    await supabase.from('pagos').insert({
      pedido_id: orderId,
      monto: amountForPayment || 0,
      metodo: 'card',
      estado: 'paid',
      transaction_id: norm.culqiChargeId,
      restaurant_id: restaurantId,
      psp: 'culqi',
      psp_event_id: norm.pspEventId || null,
      psp_order_id: norm.culqiOrderId || null,
      psp_charge_id: norm.culqiChargeId || null,
      currency: norm.currency || 'PEN',
      psp_payload: norm.raw,
    });

    await supabase.from('pedidos').update({ estado: 'pagado' }).eq('id', orderId);

    // 2) Construir CPE (si falta billing, lo armo desde metadata)
    const { pedido, detalles } = await getPedidoCompleto(orderId);
    let billing = pedido?.billing_client || {};
    if (!billing || Object.keys(billing).length === 0) {
      billing = buildBillingFromMetadata(md, comprobanteTipo);
    }

    const emisor = await getEmisorByRestaurant(restaurantId);
    const { serie, correlativo } = await reservarCorrelativo(restaurantId, comprobanteTipo);
    const fechaEmisionISO = nowLimaISO();

    const { body: cpeBody, totals } = buildCPE({
      tipoDoc: comprobanteTipo,
      serie,
      correlativo,
      fechaEmisionISO,
      emisor,
      billing,
      detalles,
      pedido,
    });

    // 3) Guardar CPE PENDIENTE
    const { data: cpeInsert, error: eCpe } = await supabase
      .from('cpe_documents')
      .insert([{
        restaurant_id: restaurantId,
        pedido_id: orderId,
        tipo_doc: comprobanteTipo,
        serie,
        correlativo,
        moneda: norm.currency || 'PEN',
        subtotal: totals.valorVenta,
        igv: totals.mtoIGV,
        total: totals.mtoImpVenta,
        estado: 'PENDIENTE',
        client: billing,
        raw_request: cpeBody,
      }])
      .select('id')
      .maybeSingle();
    if (eCpe) throw eCpe;
    cpeId = cpeInsert.id;

    // 4) Enviar a APIsPERU
    const resp = await emitirInvoice({ restaurantId, cpeBody });

    // 5) Actualizar estado del CPE y reflejar en pedidos
    const aceptado  = Boolean(resp?.sunatResponse?.success || resp?.cdrZip);
    const rechazado = Boolean(resp?.sunatResponse?.error);
    const estadoDoc = aceptado ? 'ACEPTADO' : (rechazado ? 'RECHAZADO' : 'ENVIADO');

    const update = {
      estado: estadoDoc,
      xml_url: resp?.links?.xml || null,
      pdf_url: resp?.links?.pdf || null,
      cdr_url: resp?.links?.cdr || null,
      hash: resp?.hash || null,
      digest: resp?.digestValue || null,
      sunat_ticket: resp?.ticket || null,
      raw_response: resp,
    };
    await supabase.from('cpe_documents').update(update).eq('id', cpeId);

    await supabase
      .from('pedidos')
      .update({ cpe_id: cpeId, sunat_estado: estadoDoc })
      .eq('id', orderId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    const rawErr = err?.response || { message: err?.message, stack: err?.stack };
    if (cpeId) {
      await supabase.from('cpe_documents')
        .update({ estado: 'RECHAZADO', raw_response: rawErr })
        .eq('id', cpeId);
    }
    if (orderId) {
      await supabase.from('pedidos').update({ sunat_estado: 'RECHAZADO' }).eq('id', orderId);
    }
    console.error('Culqi webhook error:', err?.message);
    return res.status(200).json({ ok: false, error: err?.message });
  }
});

module.exports = router;
