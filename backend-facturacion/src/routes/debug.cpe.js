const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');
const { emitirInvoice, getEmisorByRestaurant } = require('../services/facturador');

const APISPERU_BASE = process.env.APISPERU_BASE || 'https://facturacion.apisperu.com/api/v1';

// =========================
// GET último CPE por pedido
// =========================
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

// =========================
// Reintentar envío de CPE
// =========================
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

    const resp = await emitirInvoice({
      restaurantId: cpe.restaurant_id,
      cpeBody: cpe.raw_request,
    });

    const success =
      resp?.accepted ||
      resp?.sunat_response?.success ||
      resp?.sunatResponse?.success;

    const hasError = !!(
      resp?.error || resp?.sunat_response?.error || resp?.sunatResponse?.error
    );

    const estado = success ? 'ACEPTADO' : hasError ? 'RECHAZADO' : 'ENVIADO';

    const update = {
      estado,
      xml_url: resp?.links?.xml || null,
      pdf_url: resp?.links?.pdf || null,
      cdr_url: resp?.links?.cdr || null,
      hash: resp?.hash || null,
      digest: resp?.digestValue || null,
      sunat_ticket: resp?.ticket || null,
      sunat_notas:
        resp?.sunatResponse?.error?.message ||
        resp?.sunat_response?.error?.message ||
        resp?.error?.message || null,
      raw_response: resp,
    };

    await supabase.from('cpe_documents').update(update).eq('id', cpeId);

    await supabase
      .from('pedidos')
      .update({ cpe_id: cpeId, sunat_estado: estado })
      .eq('id', cpe.pedido_id);

    return res.json({ ok: true, update, pedido_id: cpe.pedido_id });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

// =========================
// PDF STREAM directo
// =========================
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
    const token =
      (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();

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
      try {
        err = JSON.parse(buf.toString('utf8'));
      } catch {
        err = { message: 'No se pudo generar PDF' };
      }
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

// =========================
// Guardar PDF en Storage (solo path)
// =========================
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
    const token =
      (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();

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
      try {
        err = JSON.parse(buf.toString('utf8'));
      } catch {
        err = { message: 'No se pudo generar PDF' };
      }
      return res.status(400).json({ ok: false, status: r.status, error: err });
    }

    const filename = `${cpe.serie}-${cpe.correlativo}.pdf`;
    const path = `${emisor.ruc}/${filename}`;

    const { error: eUp } = await supabase.storage
      .from('cpe')
      .upload(path, buf, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (eUp) throw eUp;

    // Guardamos solo el path interno
    const pdfPath = path;

    await supabase
      .from('cpe_documents')
      .update({ pdf_url: pdfPath })
      .eq('id', cpeId);

    return res.json({ ok: true, pdf_url: pdfPath, storage_path: pdfPath });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message });
  }
});

// =========================
// GET → Generar URL firmada del PDF
// =========================
router.get('/cpe/:cpeId/pdf', async (req, res) => {
  try {
    const cpeId = Number(req.params.cpeId);
    if (!cpeId) throw new Error('cpeId inválido');

    const { data: cpe, error } = await supabase
      .from('cpe_documents')
      .select('id, restaurant_id, pdf_url')
      .eq('id', cpeId)
      .maybeSingle();

    if (error) throw error;
    if (!cpe) throw new Error('CPE no encontrado');
    if (!cpe.pdf_url) throw new Error('CPE sin pdf_path almacenado');

    const path = cpe.pdf_url;

    const { data: signed, error: signedError } = await supabase.storage
      .from('cpe')
      .createSignedUrl(path, 60 * 5);

    if (signedError) throw signedError;
    if (!signed?.signedUrl) throw new Error('No se pudo generar URL firmada');

    return res.redirect(signed.signedUrl);
  } catch (e) {
    console.error('Error en GET /cpe/:cpeId/pdf', e);
    return res.status(400).json({ ok: false, error: e.message });
  }
});

module.exports = router;
