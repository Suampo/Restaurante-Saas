// backend-facturacion/src/routes/pedidos.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { supabase } = require('../services/supabase');
const { reservarCorrelativo } = require('../services/series');

const { PEDIDOS_URL, INTERNAL_KDS_TOKEN } = process.env;

// ========= Config =========
const APISPERU_BASE = (process.env.APISPERU_BASE || '').trim(); // ej. https://facturacion.apisperu.com/api/v1
const CPE_BUCKET    = (process.env.CPE_BUCKET || 'cpe').trim();

// ================== Utils num/fechas ==================
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function splitIgvFromTotal(total) {
  const t = Number(total || 0);
  const base = t / 1.18;
  const igv  = t - base;
  return { subtotal: r2(base), igv: r2(igv) };
}

function nowIsoPeru() {
  const d = new Date(Date.now() - 5 * 3600 * 1000);
  const pad = (x) => String(x).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const mm   = pad(d.getUTCMonth() + 1);
  const dd   = pad(d.getUTCDate());
  const HH   = pad(d.getUTCHours());
  const MM   = pad(d.getUTCMinutes());
  const SS   = pad(d.getUTCSeconds());
  return { iso: `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}-05:00`, date: `${yyyy}-${mm}-${dd}`, time: `${HH}:${MM}:${SS}` };
}

function toNumber(n) {
  if (typeof n === 'string') {
    const s = n.replace(',', '.').replace(/[^0-9.]/g, '');
    const v = Number(s);
    return Number.isFinite(v) ? v : 0;
  }
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function formatLegend(total) {
  const t = Number(total || 0).toFixed(2);
  return `SON ${t} SOLES`;
}

// ================== Notificar al KDS (backend-pedidos) ==================
async function notifyKdsPedidoPagado(restaurantId, pedidoId) {
  try {
    const base = (PEDIDOS_URL || '').trim();
    if (!base) return;

    const url = `${base.replace(/\/+$/, '')}/api/webhooks/kds/pedido-pagado`;

    const headers = { 'Content-Type': 'application/json' };
    if (INTERNAL_KDS_TOKEN) {
      headers['x-internal-token'] = INTERNAL_KDS_TOKEN;
    }

    await axios.post(
      url,
      { restaurantId, pedidoId },
      { headers, timeout: 10000 }
    );
  } catch (e) {
    console.warn('[notifyKdsPedidoPagado] warn:', e.message);
  }
}

// ================== Normalización cliente ==================
function mapTipoDocToCode(tipo) {
  if (tipo == null) return '1';
  const s = String(tipo).trim().toUpperCase();
  if (s === 'DNI' || s === '1') return '1';
  if (s === 'RUC' || s === '6') return '6';
  if (s === 'CE'  || s === 'CEX' || s === '4') return '4';
  return /^\d$/.test(s) ? s : '1';
}

function normalizeBillingClient(billing, comprobanteTipo) {
  const c = { ...(billing || {}) };
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);

  const aliases = {
    tipoDoc: c.tipoDoc ?? c.documentoTipo ?? c.docTipo ?? c.tipoDocumento ?? c.documentType ?? c.docType ?? c.tipo,
    numDoc : c.numDoc  ?? c.numeroDoc   ?? c.documentoNumero ?? c.docNumero ?? c.documentNumber ?? c.num_documento ?? c.nroDoc ?? c.nro_documento ?? c.dni ?? c.ruc ?? c.doc ?? c.numero ?? c.docNumber,
    rznSocial: c.rznSocial ?? c.razonSocial ?? c.razon_social,
    nombres  : c.nombres ?? c.nombre ?? c.full_name ?? c.fullName ?? c.name,
    apellidos: c.apellidos ?? c.last_name ?? c.lastname ?? c.apellido,
    email    : c.email,
    telefono : c.telefono ?? c.phone,
    direccion: c.direccion ?? c.address,
    ubigeo   : c.ubigeo,
  };

  Object.keys(aliases).forEach(k => {
    if (aliases[k] != null) aliases[k] = trim(aliases[k]);
  });

  const out = { ...aliases };
  out.tipoDoc = mapTipoDocToCode(out.tipoDoc);

  if (comprobanteTipo === '01') {
    out.tipoDoc = '6';
    if (!/^\d{11}$/.test(String(out.numDoc || ''))) throw new Error('Para FACTURA se requiere RUC (11 dígitos)');
    if (!out.rznSocial && !out.nombres) throw new Error('Para FACTURA se requiere razón social');
  } else {
    if (out.tipoDoc === '1' && out.numDoc && !/^\d{8}$/.test(String(out.numDoc))) {
      throw new Error('DNI inválido en billingClient.numDoc (8 dígitos)');
    }
  }

  if (out.email && !/^\S+@\S+\.\S+$/.test(out.email)) throw new Error('Email inválido');
  if (!out.rznSocial && !out.nombres) out.nombres = 'SIN NOMBRE';

  return out;
}

// ================== Helpers restaurant/emisor ==================
async function ensureRestaurantId({ restaurantId, mesaId }) {
  if (restaurantId) return Number(restaurantId);
  if (!mesaId) throw new Error('restaurantId o mesaId requerido');

  const { data: mesa, error } = await supabase
    .from('mesas')
    .select('id, restaurant_id')
    .eq('id', mesaId)
    .maybeSingle();
  if (error) throw error;
  if (!mesa) throw new Error('Mesa no encontrada');
  return Number(mesa.restaurant_id);
}

async function getEmisorForRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from('sunat_emisores')
    .select('ruc, razon_social, nombre_comercial, ubigeo, departamento, provincia, distrito, direccion, urbanizacion, apiperu_company_token, ambiente')
    .eq('restaurant_id', Number(restaurantId))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Emisor no configurado');
  if (!data.ruc) throw new Error('Emisor sin RUC');
  return data;
}

async function getRucFolder(restaurantId) {
  try {
    const { data } = await supabase
      .from('sunat_emisores')
      .select('ruc')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();
    return (data?.ruc || String(restaurantId)).trim();
  } catch {
    return String(restaurantId);
  }
}

// ================== Storage / Upload ==================
function stripBase64Prefix(b64) {
  if (!b64 || typeof b64 !== 'string') return b64;
  const idx = b64.indexOf(',');
  return idx >= 0 ? b64.slice(idx + 1) : b64;
}

async function uploadCpeFiles({ restaurantId, serie, correlativo, xmlTextOrB64, pdfB64, cdrB64 }) {
  const rucFolder = await getRucFolder(restaurantId);
  const basePath  = `${rucFolder}/${serie}-${correlativo}`;

  let uploadedXml = false, uploadedPdf = false, uploadedCdr = false;

  if (xmlTextOrB64) {
    let xmlBytes;
    if (String(xmlTextOrB64).trim().startsWith('<?xml')) {
      xmlBytes = Buffer.from(String(xmlTextOrB64), 'utf8');
    } else {
      const clean = stripBase64Prefix(String(xmlTextOrB64));
      xmlBytes = Buffer.from(clean, 'base64');
    }
    await supabase.storage.from(CPE_BUCKET).upload(`${basePath}.xml`, xmlBytes, { upsert: true, contentType: 'application/xml' });
    uploadedXml = true;
  }
  if (pdfB64) {
    const clean = stripBase64Prefix(pdfB64);
    const bytes = Buffer.from(clean, 'base64');
    await supabase.storage.from(CPE_BUCKET).upload(`${basePath}.pdf`, bytes, { upsert: true, contentType: 'application/pdf' });
    uploadedPdf = true;
  }
  if (cdrB64) {
    const clean = stripBase64Prefix(cdrB64);
    const bytes = Buffer.from(clean, 'base64');
    await supabase.storage.from(CPE_BUCKET).upload(`${basePath}.zip`, bytes, { upsert: true, contentType: 'application/zip' });
    uploadedCdr = true;
  }

  const urls = { pdf_url: null, xml_url: null, cdr_url: null };
  if (uploadedPdf) urls.pdf_url = supabase.storage.from(CPE_BUCKET).getPublicUrl(`${basePath}.pdf`).data.publicUrl || null;
  if (uploadedXml) urls.xml_url = supabase.storage.from(CPE_BUCKET).getPublicUrl(`${basePath}.xml`).data.publicUrl || null;
  if (uploadedCdr) urls.cdr_url = supabase.storage.from(CPE_BUCKET).getPublicUrl(`${basePath}.zip`).data.publicUrl || null;
  return urls;
}

// ================== Totales e ítems ==================
function calcTotalFromItems(items = []) {
  return items.reduce((acc, it) => {
    const qty   = toNumber(it.qty ?? it.cantidad ?? 1);
    const price = toNumber(it.unit_price ?? it.price ?? it.precio ?? it.precio_unitario ?? 0);
    return acc + qty * price;
  }, 0);
}

async function estimateTotalFromDb(items = [], restaurantId) {
  if (!items?.length) return 0;

  const menuIds  = [...new Set(items.map(i => Number(i.menu_item_id ?? i.menuItemId ?? i.id ?? 0)).filter(Boolean))];
  const comboIds = [...new Set(items.map(i => Number(i.combo_id     ?? i.comboId     ?? 0)).filter(Boolean))];

  const menuMap = new Map();
  const comboMap = new Map();

  if (menuIds.length) {
    const { data } = await supabase
      .from('menu_items')
      .select('id, precio')
      .in('id', menuIds)
      .eq('restaurant_id', restaurantId);
    (data || []).forEach(r => menuMap.set(Number(r.id), Number(r.precio || 0)));
  }
  if (comboIds.length) {
    const { data } = await supabase
      .from('combos')
      .select('id, precio')
      .in('id', comboIds)
      .eq('restaurant_id', restaurantId);
    (data || []).forEach(r => comboMap.set(Number(r.id), Number(r.precio || 0)));
  }

  let total = 0;
  for (const it of items) {
    const qty = toNumber(it.qty ?? it.cantidad ?? 1);
    const mid = Number(it.menu_item_id ?? it.menuItemId ?? it.id ?? 0);
    const cid = Number(it.combo_id ?? it.comboId ?? 0);

    let unit = toNumber(it.unit_price ?? it.price ?? it.precio ?? it.precio_unitario);
    if (!unit) {
      if (cid) unit = comboMap.get(cid) || 0;
      else if (mid) unit = menuMap.get(mid) || 0;
    }
    total += qty * unit;
  }
  return total;
}

async function insertDetallesIfAny(pedidoId, restaurantId, items = []) {
  if (!items?.length) return;

  const menuIds  = [...new Set(items.map(i => Number(i.menu_item_id ?? i.menuItemId ?? i.id ?? 0)).filter(Boolean))];
  const comboIds = [...new Set(items.map(i => Number(i.combo_id     ?? i.comboId     ?? 0)).filter(Boolean))];

  const menuMap = new Map();
  const comboMap = new Map();

  if (menuIds.length) {
    const { data } = await supabase
      .from('menu_items').select('id, precio')
      .in('id', menuIds).eq('restaurant_id', restaurantId);
    (data || []).forEach(r => menuMap.set(Number(r.id), Number(r.precio || 0)));
  }
  if (comboIds.length) {
    const { data } = await supabase
      .from('combos').select('id, precio')
      .in('id', comboIds).eq('restaurant_id', restaurantId);
    (data || []).forEach(r => comboMap.set(Number(r.id), Number(r.precio || 0)));
  }

  const rows = [];
  for (const it of items) {
    const qty = Math.max(1, toNumber(it.cantidad ?? it.qty ?? 1));
    const mid = Number(it.menu_item_id ?? it.menuItemId ?? it.id ?? 0);
    const cid = Number(it.combo_id ?? it.comboId ?? 0);
    if (!mid && !cid) continue;

    let unit = toNumber(it.precio_unitario ?? it.unit_price ?? it.price ?? it.precio ?? 0);
    if (!unit) {
      if (cid) unit = comboMap.get(cid) || 0;
      else if (mid) unit = menuMap.get(mid) || 0;
    }

    rows.push({
      pedido_id: pedidoId,
      menu_item_id: mid || null,
      combo_id: cid || null,
      cantidad: qty,
      precio_unitario: r2(unit),
    });
  }
  if (!rows.length) return;
  const { error } = await supabase.from('pedido_detalle').insert(rows);
  if (error) throw error;
}

// ================== Payload Greenter (compatible) ==================
function buildGreenterPayload({ tipoDoc, serie, correlativo, emisor, pedido, detalle, subtotal, igv, total }) {
  const cli = pedido?.billing_client || {};
  const tipoDocCliente = mapTipoDocToCode(cli.tipoDoc);
  const numDocCliente  = (cli.numDoc || '').trim();

  const razonSocialCliente =
    cli.rznSocial ||
    `${cli.nombres || ''} ${cli.apellidos || ''}`.trim() ||
    'SIN NOMBRE';

  const { iso, time } = nowIsoPeru();

  const detalles = (detalle || []).map((d, idx) => {
    const cant = Number(d.cantidad || 1);
    const pIgv = Number(d.precio_unitario || 0);
    const vUnit = r2(pIgv / 1.18);
    const base  = r2(vUnit * cant);
    const igvLn = r2(pIgv * cant - base);
    return {
      unidad: 'NIU',
      cantidad: cant,
      descripcion: d.descripcion || `Item ${idx + 1}`,
      tipAfeIgv: 10,
      porcentajeIgv: 18,
      precioUnitario: pIgv,
      mtoPrecioUnitario: pIgv,
      mtoValorUnitario: vUnit,
      mtoBaseIgv: base,
      igv: igvLn,
      mtoValorVenta: base,
      totalImpuestos: igvLn,
      codProducto: String(idx + 1).padStart(3, '0')
    };
  });

  const mtoGrav = r2(total / 1.18);
  const mtoIgv  = r2(total - mtoGrav);

  const payload = {
    tipoDoc: tipoDoc,
    serie: String(serie),
    correlativo: String(correlativo),
    fechaEmision: iso,
    horaEmision: time,
    tipoMoneda: 'PEN',
    tipoOperacion: '0101',
    mtoOperGravadas: mtoGrav,
    mtoIGV: mtoIgv,
    mtoImpVenta: r2(total),
    subTotal: r2(total),
    valorVenta: mtoGrav,
    totalImpuestos: mtoIgv,
    legends: [{ code: '1000', value: formatLegend(total) }],

    company: {
      ruc: emisor.ruc,
      razonSocial: emisor.razon_social || emisor.nombre_comercial || '',
      nombreComercial: emisor.nombre_comercial || emisor.razon_social || '',
      address: {
        ubigeo: emisor.ubigeo || '',
        departamento: emisor.departamento || '',
        provincia: emisor.provincia || '',
        distrito: emisor.distrito || '',
        direccion: emisor.direccion || '',
        urbanizacion: emisor.urbanizacion || ''
      }
    },

    cliente: {
      tipoDoc: tipoDocCliente,
      numDoc: numDocCliente || undefined,
      nombres: razonSocialCliente,
      rznSocial: razonSocialCliente,
      email: pedido?.billing_email || cli.email || undefined,
      direccion: cli.direccion || undefined
    },

    detalles
  };

  payload.client  = {
    type: payload.cliente.tipoDoc,
    tipoDoc: payload.cliente.tipoDoc,
    numDoc : payload.cliente.numDoc,
    nombres: payload.cliente.nombres,
    rznSocial: payload.cliente.rznSocial,
    email: payload.cliente.email,
    direccion: payload.cliente.direccion,
  };
  payload.details = (payload.detalles || []).map(d => ({
    igv: d.igv, unidad: d.unidad, cantidad: d.cantidad, tipAfeIgv: d.tipAfeIgv,
    mtoBaseIgv: d.mtoBaseIgv, codProducto: d.codProducto, descripcion: d.descripcion,
    porcentajeIgv: d.porcentajeIgv, mtoValorUnitario: d.mtoValorUnitario,
    mtoPrecioUnitario: d.mtoPrecioUnitario, mtoValorVenta: d.mtoValorVenta,
    totalImpuestos: d.totalImpuestos,
  }));

  return payload;
}

// ================== Llamadas a ApisPerú ==================
function pickXml(body)  { return body?.xml || body?.files?.xml || null; }
function pickPdf(body) {
  if (!body) return null;
  if (typeof body === 'string') return body.trim();
  return body?.pdf || body?.files?.pdf || body?.content || body?.data || null;
}
function pickCdr(body)  { return body?.cdrZip || body?.files?.cdr || body?.sunatResponse?.cdrZip || body?.cdrResponse?.cdrZip || null; }

async function postApisPeruTry(url, { headers, payload }) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(headers || {}) },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { res, data };
}

async function postApisPeruSmart({ base, token, payload }) {
  const attempts = [];
  const url = `${base.replace(/\/+$/, '')}/invoice/send`;
  const { res, data } = await postApisPeruTry(url, {
    headers: { Authorization: `Bearer ${token}` },
    payload
  });
  attempts.push({ endpoint: url, auth: 'Bearer', status: res.status, body: data });

  if (res.ok) {
    return { ok: true, endpoint: url, auth: 'Bearer', status: res.status, body: data, attempts };
  }
  return { ok: false, endpoint: url, auth: 'Bearer', status: res.status, body: data, attempts };
}

async function generateInvoicePdf({ base, token, payload }) {
  try {
    const url = `${base.replace(/\/+$/, '')}/invoice/pdf`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, application/pdf',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    let body = null;
    let pdfB64 = null;

    if (/application\/pdf|application\/octet-stream/.test(contentType)) {
      const buf = await res.arrayBuffer();
      pdfB64 = Buffer.from(buf).toString('base64');
      body = { note: 'binary-pdf' };
    } else {
      const text = await res.text();
      let parsed = null;
      try { parsed = text ? JSON.parse(text) : null; } catch {}
      body = parsed ?? text;

      pdfB64 = pickPdf(body);
      if (!pdfB64 && typeof body === 'string') {
        const s = body.trim();
        if (/^[A-Za-z0-9+/=\s]+$/.test(s) && s.length > 80) {
          pdfB64 = s;
        }
      }
    }

    return { ok: !!pdfB64, endpoint: url, status: res.status, body, pdfB64, content_type: contentType };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

async function emitWithApisPeru({ restaurantId, tipoDoc, serie, correlativo, pedido, detalle, subtotal, igv, total }) {
  if (!APISPERU_BASE) throw new Error('APISPERU_BASE no configurado');

  const emisor = await getEmisorForRestaurant(restaurantId);
  const token  = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();

  const payload = buildGreenterPayload({ tipoDoc, serie, correlativo, emisor, pedido, detalle, subtotal, igv, total });
  if (!token) {
    const err = new Error('Token de empresa (apiperu_company_token) no configurado');
    err.raw = { request: payload, reason: 'missing_token' };
    throw err;
  }

  const r = await postApisPeruSmart({ base: APISPERU_BASE, token, payload });

  const raw = { endpoint: r.endpoint, auth: r.auth, status: r.status, body: r.body, attempts: r.attempts, request: payload };

  if (!r.ok) {
    const msg = typeof r.body === 'string'
      ? r.body
      : (r.body?.error || r.body?.message || 'Emisión falló');
    const err = new Error(`ApisPerú: ${msg}`);
    err.raw = raw;
    throw err;
  }

  let xmlTextOrB64 = pickXml(r.body);
  let pdfB64       = pickPdf(r.body);
  let cdrB64       = pickCdr(r.body);

  if (!pdfB64) {
    const gp = await generateInvoicePdf({ base: APISPERU_BASE, token, payload });
    if (gp.ok && gp.pdfB64) pdfB64 = gp.pdfB64;
    raw.pdf_generation = { endpoint: gp.endpoint, status: gp.status, ok: gp.ok, error: gp.error };
  }

  return {
    estado: (r.body?.success ? 'ACEPTADO' : (r.body?.estado || 'ACEPTADO')),
    hash  : r.body?.hash || null,
    digest: r.body?.digest || null,
    files : { xmlTextOrB64, pdfB64, cdrB64 },
    raw_response: raw
  };
}

// ================== AUTO EMISIÓN CPE ==================
// (sin cambios al manejo de note)
async function autoEmitCpeIfNeeded(pedidoId) {
  const { data: pedido, error: ePed } = await supabase
    .from('pedidos')
    .select('id, restaurant_id, total, comprobante_tipo, billing_client, billing_email, cpe_id, sunat_estado')
    .eq('id', pedidoId)
    .maybeSingle();
  if (ePed) throw ePed;
  if (!pedido) throw new Error('Pedido no encontrado');

  const tipoDoc = pedido.comprobante_tipo;
  if (!tipoDoc) return;

  const restaurantId = Number(pedido.restaurant_id);
  const total = Number(pedido.total || 0);
  if (!total) throw new Error('Total inválido');

  const { data: existing } = await supabase
    .from('cpe_documents')
    .select('id, serie, correlativo')
    .eq('pedido_id', pedidoId)
    .maybeSingle();
  if (existing?.id) {
    if (!pedido.cpe_id) {
      await supabase.from('pedidos')
        .update({ cpe_id: existing.id, updated_at: new Date().toISOString() })
        .eq('id', pedidoId);
    }
    return existing;
  }

  const { subtotal, igv } = splitIgvFromTotal(total);

  let detalle = [];
  try {
    const { data: det } = await supabase
      .from('pedido_detalle')
      .select('cantidad, precio_unitario, menu_item_id, combo_id')
      .eq('pedido_id', pedidoId);

    if (det?.length) {
      const menuIds  = [...new Set(det.map(d => Number(d.menu_item_id || 0)).filter(Boolean))];
      const comboIds = [...new Set(det.map(d => Number(d.combo_id || 0)).filter(Boolean))];

      const menuName  = new Map();
      const comboName = new Map();

      if (menuIds.length) {
        const { data: menus } = await supabase
          .from('menu_items')
          .select('id, nombre')
          .in('id', menuIds);
        (menus || []).forEach(m => menuName.set(Number(m.id), m.nombre || `Item ${m.id}`));
      }
      if (comboIds.length) {
        const { data: combos } = await supabase
          .from('combos')
          .select('id, nombre')
          .in('id', comboIds);
        (combos || []).forEach(c => comboName.set(Number(c.id), c.nombre || `Combo ${c.id}`));
      }

      detalle = det.map((d, idx) => {
        const mid  = Number(d.menu_item_id || 0);
        const cid  = Number(d.combo_id || 0);
        const desc = (mid && menuName.get(mid)) || (cid && comboName.get(cid)) || `Item ${idx + 1}`;
        return {
          descripcion: desc,
          cantidad: Number(d.cantidad || 1),
          precio_unitario: Number(d.precio_unitario || 0),
        };
      });
    }
  } catch {}
  if (!detalle.length) {
    detalle = [{ descripcion: 'Consumo en restaurante', cantidad: 1, precio_unitario: r2(total) }];
  }

  const { serie, correlativo } = await reservarCorrelativo(restaurantId, tipoDoc);

  const { data: inserted, error: eIns } = await supabase
    .from('cpe_documents')
    .insert([{
      restaurant_id: restaurantId,
      pedido_id: pedidoId,
      tipo_doc: tipoDoc,
      serie,
      correlativo,
      fecha_emision: new Date().toISOString(),
      moneda: 'PEN',
      subtotal: r2(subtotal),
      igv: r2(igv),
      total: r2(total),
      estado: 'PENDIENTE',
      client: pedido.billing_client || null,
      raw_request: null,
      raw_response: null
    }])
    .select('id')
    .maybeSingle();
  if (eIns) throw eIns;

  const cpeId = inserted.id;

  await supabase
    .from('pedidos')
    .update({ cpe_id: cpeId, updated_at: new Date().toISOString() })
    .eq('id', pedidoId);

  let finalEstado = 'ACEPTADO';
  try {
    const r = await emitWithApisPeru({
      restaurantId, tipoDoc, serie, correlativo, pedido,
      detalle, subtotal: r2(subtotal), igv: r2(igv), total: r2(total)
    });

    const urls = await uploadCpeFiles({
      restaurantId, serie, correlativo,
      xmlTextOrB64: r?.files?.xmlTextOrB64 || null,
      pdfB64: r?.files?.pdfB64 || null,
      cdrB64: r?.files?.cdrB64 || null
    });

    finalEstado = r?.estado || 'ACEPTADO';

    await supabase.from('cpe_documents').update({
      estado: finalEstado,
      hash: r?.hash || null,
      digest: r?.digest || null,
      xml_url: urls.xml_url,
      pdf_url: urls.pdf_url,
      cdr_url: urls.cdr_url,
      raw_request: r?.raw_response?.request || null,
      raw_response: {
        auth: r?.raw_response?.auth,
        endpoint: r?.raw_response?.endpoint,
        status: r?.raw_response?.status,
        body: r?.raw_response?.body,
        attempts: r?.raw_response?.attempts || [],
        pdf_generation: r?.raw_response?.pdf_generation || null
      },
      updated_at: new Date().toISOString(),
    }).eq('id', cpeId);
  } catch (e) {
    console.warn('[emitCPE] emisión fallida:', e.message);
    const raw = e?.raw || { error: e.message, where: 'emitWithApisPeru.pre' };
    await supabase.from('cpe_documents').update({
      estado: 'RECHAZADO',
      sunat_notas: e?.message || null,
      raw_request: raw.request || null,
      raw_response: raw,
      updated_at: new Date().toISOString(),
    }).eq('id', cpeId);
    finalEstado = 'RECHAZADO';
  }

  await supabase
    .from('pedidos')
    .update({ sunat_estado: finalEstado, updated_at: new Date().toISOString() })
    .eq('id', pedidoId);

  return { id: cpeId, estado: finalEstado };
}

// ================== POST /api/pedidos ==================
router.post('/pedidos', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const {
      mesaId,
      restaurantId: _restaurantId,
      items = [],
      idempotencyKey,
      amount, total,
      comprobanteTipo,
      billingClient,
      billingEmail,
      note: rawNote, // 👈 viene del frontend
    } = req.body || {};

    const note =
      typeof rawNote === 'string' ? rawNote.trim().slice(0, 300) : null;

    if (!comprobanteTipo || !['01','03'].includes(comprobanteTipo)) {
      throw new Error('comprobanteTipo requerido ("01"|"03")');
    }
    if (!billingClient) throw new Error('billingClient requerido');

    const restaurantId = await ensureRestaurantId({ restaurantId: _restaurantId, mesaId });
    const billing = normalizeBillingClient(billingClient, comprobanteTipo);

    let computed = toNumber(amount ?? total);
    if (computed && Number.isInteger(computed) && computed >= 100) computed = computed / 100;
    if (!(computed > 0)) computed = calcTotalFromItems(items);
    if (!(computed > 0)) computed = await estimateTotalFromDb(items, restaurantId);
    if (!(computed > 0)) throw new Error('No se pudo determinar el total del pedido');

    const totalSoles = r2(computed);

    const { data: inserted, error } = await supabase
      .from('pedidos')
      .insert([{
        restaurant_id: restaurantId,
        mesa_id: mesaId ?? null,
        total: totalSoles,
        estado: 'pendiente_pago',
        idempotency_key: idempotencyKey ?? null,
        comprobante_tipo: comprobanteTipo,
        billing_client: billing,
        billing_email: billingEmail || billing.email || null,
        note, // 👈 guardamos la nota
      }])
      .select('id,total')
      .maybeSingle();
    if (error) throw error;

    await insertDetallesIfAny(inserted.id, restaurantId, items);

    return res.json({
      pedidoId: inserted.id,
      amount: Math.round(Number(inserted.total) * 100),
      currency: 'PEN'
    });
  } catch (e) {
    const conflict =
      e?.code === '23505' &&
      /uniq_open_order_per_table/i.test(String(e?.constraint || e?.message || ''));

    if (conflict) {
      try {
        const mesaId = Number(req.body?.mesaId || 0);
        let restaurantId = Number(req.body?.restaurantId || 0);

        if (!restaurantId && mesaId) {
          const { data: mesa } = await supabase
            .from('mesas')
            .select('restaurant_id')
            .eq('id', mesaId)
            .maybeSingle();
          if (mesa?.restaurant_id) restaurantId = Number(mesa.restaurant_id);
        }

        const { data: existing } = await supabase
          .from('pedidos')
          .select('id')
          .eq('restaurant_id', restaurantId)
          .eq('mesa_id', mesaId)
          .eq('estado', 'pendiente_pago')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return res
          .status(409)
          .json({ error: 'La mesa ya tiene un pedido abierto', pedidoId: existing?.id || null });
      } catch (_) {}
    }

    console.error('POST /api/pedidos error:', e.message);
    return res.status(400).json({ error: e.message });
  }
});

// ================== PATCH abandonar ==================
router.patch('/pedidos/:id/abandonar', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const { data: ped } = await supabase
      .from('pedidos')
      .select('id, estado')
      .eq('id', id)
      .maybeSingle();

    if (!ped) return res.status(404).json({ error: 'Pedido no encontrado' });
    if (ped.estado !== 'pendiente_pago') {
      return res.status(409).json({ error: 'El pedido ya no está pendiente de pago' });
    }

    const { error: eUpd } = await supabase
      .from('pedidos')
      .update({ estado: 'anulado', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (eUpd) throw eUpd;

    return res.sendStatus(204);
  } catch (e) {
    console.error('PATCH /pedidos/:id/abandonar error:', e.message);
    return res.status(500).json({ error: 'No se pudo abandonar el pedido' });
  }
});

// ================== POST pagado (MP/Yape) ==================
router.post('/pedidos/:id/pagado', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const {
      amount, pasarela, payment_id, method, status,
      psp_event_id, psp_order_id, psp_charge_id, approved_at
    } = req.body || {};

    const { data: pedido, error: e1 } = await supabase
      .from('pedidos')
      .select('id,total,estado,restaurant_id,comprobante_tipo,billing_client,billing_email')
      .eq('id', id)
      .maybeSingle();
    if (e1) throw e1;
    if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });

    // === Guardar/actualizar fila en pagos con IDs de PSP ===
    const eventId  = psp_event_id ? String(psp_event_id) : (payment_id ? String(payment_id) : null);
    const chargeId = psp_charge_id ? String(psp_charge_id) : (payment_id ? String(payment_id) : null);
    const orderId  = psp_order_id ? String(psp_order_id) : null;

    const monto = amount != null ? Number(amount) : Number(pedido.total);
    const row = {
      pedido_id     : id,
      monto         : monto,
      metodo        : method || 'mercado_pago',
      estado        : status || 'approved',
      transaction_id: payment_id ? String(payment_id) : null,
      restaurant_id : Number(pedido.restaurant_id) || null,
      psp           : (pasarela || 'mercado_pago'),
      currency      : 'PEN',
      psp_event_id  : eventId,
      psp_order_id  : orderId,
      psp_charge_id : chargeId,
      psp_payload   : req.body || null,
      approved_at   : (String(status || '').toLowerCase() === 'approved')
                        ? (approved_at ? new Date(approved_at).toISOString() : new Date().toISOString())
                        : null
    };

    // Si recibimos eventId, intentamos idempotencia por ese evento
    if (eventId) {
      const { data: existing } = await supabase
        .from('pagos').select('id').eq('psp_event_id', eventId).maybeSingle();
      if (existing?.id) {
        await supabase.from('pagos').update(row).eq('id', existing.id);
      } else {
        await supabase.from('pagos').insert([row]);
      }
    } else {
      await supabase.from('pagos').insert([row]);
    }

    // === Estado del pedido (tu flujo actual) ===
    if (pedido.estado !== 'pagado') {
      const { error: e2 } = await supabase
        .from('pedidos')
        .update({ estado: 'pagado', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (e2) throw e2;
    }

    // === Emisión CPE (tu lógica actual) ===
    try {
      await autoEmitCpeIfNeeded(id);
    } catch (e) {
      console.warn('[autoEmitCpeIfNeeded] warn:', e.message);
    }

    // === Avisar al backend-pedidos para que el KDS reciba "pedido_pagado" ===
    try {
      const rid = Number(pedido.restaurant_id || 0);
      if (rid) {
        await notifyKdsPedidoPagado(rid, pedido.id);
      }
    } catch (e) {
      console.warn('[/pedidos/:id/pagado] notifyKdsPedidoPagado:', e.message);
    }

    return res.sendStatus(204);
  } catch (e) {
    console.error('POST /pedidos/:id/pagado error:', e.message);
    return res.status(500).json({ error: 'No se pudo marcar pagado' });
  }
});

module.exports = router;
