// backend-facturacion/src/routes/culqi.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');
const { reservarCorrelativo } = require('../services/series');
const { emitirInvoice, getEmisorByRestaurant } = require('../services/facturador');
const { getPedidoCompleto, buildCPE, nowLimaISO } = require('../services/cpe');

// Idempotencia simple por evento PSP
async function alreadyProcessed(pspEventId) {
  const { data, error } = await supabase
    .from('pagos')
    .select('id')
    .eq('psp_event_id', pspEventId)
    .limit(1);
  if (error) throw error;
  return data && data.length > 0;
}

router.post('/culqi', express.json({ type: '*/*' }), async (req, res) => {
  const ev = req.body;
  const pspEventId = ev?.id || ev?.data?.id || null;

  // Log del webhook
  await supabase.from('webhook_logs').insert({
    payload: ev,
    psp: 'culqi',
    headers: req.headers,
    payload_raw: JSON.stringify(ev),
  });

  let cpeId = null;
  let orderId = null;

  try {
    const type = ev?.type;
    if (!['order.paid', 'charge.succeeded'].includes(type)) {
      return res.status(200).json({ ok: true, ignored: type });
    }
    if (pspEventId && (await alreadyProcessed(pspEventId))) {
      return res.status(200).json({ ok: true, duplicated: true });
    }

    // Metadata enviada cuando creaste la orden/cargo
    const md = ev?.data?.metadata || ev?.metadata || {};
    orderId = Number(md.orderId);
    const restaurantId = Number(md.restaurantId);
    const comprobanteTipo = md.comprobanteTipo || '03'; // '01' | '03'
    if (!orderId || !restaurantId) throw new Error('Falta metadata {orderId, restaurantId}');

    // 1) Registrar pago y marcar pedido como pagado
    const monto =
      Number(ev?.data?.amount || ev?.data?.amount_in_cents || 0) / 100 ||
      Number(ev?.data?.amount) ||
      0;

    await supabase.from('pagos').insert({
      pedido_id: orderId,
      monto,
      metodo: 'card',
      estado: 'paid',
      transaction_id: ev?.data?.id || null,
      restaurant_id: restaurantId,
      psp: 'culqi',
      psp_event_id: pspEventId || null,
      psp_order_id: ev?.data?.order_id || null,
      psp_charge_id: ev?.data?.charge_id || ev?.data?.id || null,
      currency: ev?.data?.currency || 'PEN',
      psp_payload: ev,
    });

    await supabase.from('pedidos').update({ estado: 'pagado' }).eq('id', orderId);

    // 2) Construir CPE
    const { pedido, detalles } = await getPedidoCompleto(orderId);
    const billing = pedido?.billing_client || {};
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

    // 3) Guardar CPE como PENDIENTE
    const { data: cpeInsert, error: eCpe } = await supabase
      .from('cpe_documents')
      .insert([
        {
          restaurant_id: restaurantId,
          pedido_id: orderId,
          tipo_doc: comprobanteTipo,
          serie,
          correlativo,
          moneda: 'PEN',
          subtotal: totals.valorVenta,
          igv: totals.mtoIGV,
          total: totals.mtoImpVenta,
          estado: 'PENDIENTE',
          client: billing,
          raw_request: cpeBody,
        },
      ])
      .select('id')
      .maybeSingle();
    if (eCpe) throw eCpe;
    cpeId = cpeInsert.id;

    // 4) Enviar a APIsPERU
    const resp = await emitirInvoice({ restaurantId, cpeBody });

    // 5) Actualizar estado del CPE según respuesta
    const update = {
      estado:
        resp?.sunatResponse?.success || resp?.cdrZip
          ? 'ACEPTADO'
          : resp?.sunatResponse?.error
          ? 'RECHAZADO'
          : 'ENVIADO',
      xml_url: resp?.links?.xml || null,
      pdf_url: resp?.links?.pdf || null,
      cdr_url: resp?.links?.cdr || null,
      hash: resp?.hash || null,
      digest: resp?.digestValue || null,
      sunat_ticket: resp?.ticket || null,
      raw_response: resp,
    };
    await supabase.from('cpe_documents').update(update).eq('id', cpeId);

    // 6) **Opción 1**: NO tocar `estado` del pedido (se queda en 'pagado')
    await supabase
      .from('pedidos')
      .update({
        cpe_id: cpeId,
        sunat_estado: update.estado,
      })
      .eq('id', orderId);

    return res.status(200).json({ ok: true });
  } catch (err) {
    const rawErr = err.response || { message: err.message, stack: err.stack };
    if (cpeId) {
      await supabase
        .from('cpe_documents')
        .update({ estado: 'RECHAZADO', raw_response: rawErr })
        .eq('id', cpeId);
    }
    if (orderId) {
      // Mantener estado del pedido, solo reflejar estado SUNAT
      await supabase.from('pedidos').update({ sunat_estado: 'RECHAZADO' }).eq('id', orderId);
    }
    console.error('Culqi webhook error:', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
});

module.exports = router;
