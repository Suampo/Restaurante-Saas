// backend-facturacion/src/routes/debug.cpe.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');
const { emitirInvoice, getEmisorByRestaurant } = require('../services/facturador');

// Base de APIsPeru para PDF
const APISPERU_BASE = process.env.APISPERU_BASE || 'https://facturacion.apisperu.com/api/v1';

/**
 * GET /debug/cpe/by-pedido/:pedidoId
 * Devuelve el último CPE asociado a un pedido.
 */
router.get('/cpe/by-pedido/:pedidoId', async (req, res) => {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!pedidoId) throw new Error('pedidoId inválido');

    const { data: cpe, error } = await supabase
      .from('cpe_documents')
      .select('*')
      .eq('pedido_id', pedidoId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!cpe) return res.json({ ok: false, error: 'Sin CPE para este pedido' });

    return res.json({ ok: true, cpe });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * POST /debug/cpe/retry
 * Reintenta enviar a SUNAT el CPE ya guardado (raw_request) y
 * actualiza cpe_documents y el pedido (solo cpe_id + sunat_estado).
 * body: { cpeId }
 */
router.post('/cpe/retry', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const cpeId = Number(req.body.cpeId);
    if (!cpeId) throw new Error('falta cpeId');

    const { data: cpe, error } = await supabase
      .from('cpe_documents')
      .select('*')
      .eq('id', cpeId)
      .maybeSingle();
    if (error) throw error;
    if (!cpe) throw new Error('CPE no encontrado');

    // Re-emitir
    const resp = await emitirInvoice({
      restaurantId: cpe.restaurant_id,
      cpeBody: cpe.raw_request,
    });

    // Estado basado en la respuesta
    const estado =
      (resp?.sunatResponse?.success || resp?.cdrZip) ? 'ACEPTADO' :
      (resp?.sunatResponse?.error) ? 'RECHAZADO' : 'ENVIADO';

    // Actualizar cpe_documents
    const update = {
      estado,
      xml_url: resp?.links?.xml || null,
      pdf_url: resp?.links?.pdf || null,
      cdr_url: resp?.links?.cdr || null,
      hash: resp?.hash || null,
      digest: resp?.digestValue || null,
      sunat_ticket: resp?.ticket || null,
      raw_response: resp,
    };
    await supabase.from('cpe_documents').update(update).eq('id', cpeId);

    // 🔧 Sincroniza el pedido (solo cpe_id + sunat_estado; NO tocamos 'estado')
    await supabase.from('pedidos').update({
      cpe_id: cpeId,
      sunat_estado: estado,
    }).eq('id', cpe.pedido_id);

    return res.json({ ok: true, update, pedido_id: cpe.pedido_id });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * POST /debug/cpe/pdf-stream
 * Body: { cpeId }
 * Genera el PDF en APIsPeru y lo devuelve en la respuesta (application/pdf).
 */
router.post('/cpe/pdf-stream', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const cpeId = Number(req.body.cpeId);
    if (!cpeId) throw new Error('falta cpeId');

    const { data: cpe, error } = await supabase
      .from('cpe_documents')
      .select('id, restaurant_id, raw_request, serie, correlativo')
      .eq('id', cpeId)
      .maybeSingle();
    if (error) throw error;
    if (!cpe) throw new Error('CPE no encontrado');

    const emisor = await getEmisorByRestaurant(cpe.restaurant_id);
    const token = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();

    const r = await fetch(`${APISPERU_BASE}/invoice/pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
      },
      body: JSON.stringify(cpe.raw_request),
    });

    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok) {
      // Si viene error en JSON, intenta parsearlo
      let err;
      try { err = JSON.parse(buf.toString('utf8')); } catch { err = { message: 'No se pudo generar PDF' }; }
      return res.status(400).json({ ok: false, status: r.status, error: err });
    }

    const filename = `${cpe.serie}-${cpe.correlativo}.pdf`;
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    return res.send(buf);
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * POST /debug/cpe/pdf-save
 * Body: { cpeId }
 * Genera el PDF en APIsPeru, lo sube a Supabase Storage (bucket 'cpe') y guarda el URL en cpe_documents.pdf_url
 * Requisitos: tener bucket 'cpe' creado (público o usa signed URLs).
 */
router.post('/cpe/pdf-save', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const cpeId = Number(req.body.cpeId);
    if (!cpeId) throw new Error('falta cpeId');

    const { data: cpe, error } = await supabase
      .from('cpe_documents')
      .select('id, restaurant_id, raw_request, serie, correlativo')
      .eq('id', cpeId)
      .maybeSingle();
    if (error) throw error;
    if (!cpe) throw new Error('CPE no encontrado');

    const emisor = await getEmisorByRestaurant(cpe.restaurant_id);
    const token = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();

    const r = await fetch(`${APISPERU_BASE}/invoice/pdf`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/pdf',
      },
      body: JSON.stringify(cpe.raw_request),
    });

    const buf = Buffer.from(await r.arrayBuffer());
    if (!r.ok) {
      let err;
      try { err = JSON.parse(buf.toString('utf8')); } catch { err = { message: 'No se pudo generar PDF' }; }
      return res.status(400).json({ ok: false, status: r.status, error: err });
    }

    const filename = `${cpe.serie}-${cpe.correlativo}.pdf`;
    const path = `${emisor.ruc}/${filename}`;

    // Subir a Storage (bucket 'cpe')
    const { error: eUp } = await supabase
      .storage
      .from('cpe')
      .upload(path, buf, { contentType: 'application/pdf', upsert: true });
    if (eUp) throw eUp;

    const { data: pub } = supabase.storage.from('cpe').getPublicUrl(path);
    const pdfUrl = pub?.publicUrl || null;

    await supabase.from('cpe_documents').update({ pdf_url: pdfUrl }).eq('id', cpeId);

    return res.json({ ok: true, pdf_url: pdfUrl, storage_path: path });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

module.exports = router;
