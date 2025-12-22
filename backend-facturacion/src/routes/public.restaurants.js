"use strict";

const express = require("express");
const axios = require("axios");
const router = express.Router();

const { getEmisorByRestaurant } = require("../services/facturador");
const { supabase } = require("../services/supabase");

const APISPERU_BASE = (process.env.APISPERU_BASE || "").trim(); // ej. https://facturacion.apisperu.com/api/v1
const APISPERU_FALLBACK_TOKEN = (process.env.APISPERU_FALLBACK_TOKEN || "").trim();

/* ===================== Helpers ===================== */

function noStore(res) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

function jsonError(res, status, message, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

function sendPdfInline(res, pdfBuf, filename = "documento.pdf") {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  return res.status(200).send(Buffer.isBuffer(pdfBuf) ? pdfBuf : Buffer.from(pdfBuf));
}

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function pickNumber(obj, keys, fallback = 0) {
  for (const k of keys) {
    const v = obj?.[k];
    const n = Number(v);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return fallback;
}

function pickString(obj, keys, fallback = "") {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
  }
  return fallback;
}

/* ===================== DB Queries ===================== */

async function getPedidoById(pedidoId) {
  const { data: ped, error } = await supabase
    .from("pedidos")
    .select("id, restaurant_id, cpe_id")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) throw error;
  return ped;
}

async function getPedidoFull(pedidoId) {
  // usamos select('*') para no depender de nombres exactos de columnas
  const { data: ped, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", pedidoId)
    .maybeSingle();
  if (error) throw error;
  return ped;
}

async function getCpeById(cpeId) {
  const { data: cpe, error } = await supabase
    .from("cpe_documents")
    .select("id, raw_request, pdf_url, tipo_doc, estado, pedido_id, restaurant_id, created_at")
    .eq("id", cpeId)
    .maybeSingle();
  if (error) throw error;
  return cpe;
}

async function getReciboSimpleByPedidoId(pedidoId) {
  const { data, error } = await supabase
    .from("cpe_documents")
    .select("id, pdf_url, raw_request, tipo_doc, estado, pedido_id, restaurant_id, created_at")
    .eq("pedido_id", pedidoId)
    .eq("tipo_doc", "00")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

// Intenta obtener ítems del pedido en distintas tablas comunes.
// Si tu tabla real tiene otro nombre, cámbialo aquí.
async function getPedidoItems(pedidoId) {
  const candidates = ["pedido_detalle", "pedido_items", "pedido_productos", "detalle_pedido"];
  let lastErr = null;

  for (const table of candidates) {
    try {
      const { data, error } = await supabase.from(table).select("*").eq("pedido_id", pedidoId);
      if (error) throw error;
      if (Array.isArray(data)) return { table, rows: data };
      return { table, rows: [] };
    } catch (e) {
      lastErr = e;
      // seguimos con el siguiente candidato
    }
  }

  // Si ninguna tabla existe o falló, devolvemos vacío (no reventamos el recibo).
  console.warn("[recibo] No se pudieron leer ítems del pedido:", lastErr?.message || lastErr);
  return { table: null, rows: [] };
}

function normalizeItems(rows) {
  return (rows || []).map((r) => {
    const name = pickString(r, ["nombre", "name", "producto", "descripcion", "titulo", "title"], "Item");
    const qty = pickNumber(r, ["cantidad", "qty", "quantity", "cant"], 1);
    const price = pickNumber(r, ["precio_unitario", "precio", "price", "pu", "unit_price"], 0);
    return { name, qty, price };
  });
}

function buildReciboHtml({ ped, items }) {
  const total = pickNumber(ped, ["total", "monto_total", "importe_total", "amount"], 0);

  const pedidoVisual = pickString(ped, ["order_no", "numero", "pedido_numero", "id"], String(ped?.id || ""));
  const fecha = ped?.created_at ? new Date(ped.created_at) : new Date();

  const note = pickString(ped, ["note", "nota", "observacion", "observaciones"], "");

  const rows = items.length
    ? items
        .map(
          (it) => `
          <tr>
            <td>${esc(it.name)}</td>
            <td style="text-align:center">${it.qty}</td>
            <td style="text-align:right">S/ ${Number(it.price || 0).toFixed(2)}</td>
            <td style="text-align:right">S/ ${(Number(it.price || 0) * Number(it.qty || 1)).toFixed(2)}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="text-align:center;color:#666">Sin ítems</td></tr>`;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo #${esc(pedidoVisual)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 18px; background:#f7f7f7; }
    .card { max-width: 720px; margin:0 auto; background:#fff; border:1px solid #eee; border-radius:12px; padding:16px; }
    h1 { margin:0 0 6px; font-size:18px; }
    .muted { color:#666; font-size:12px; line-height:1.45; }
    table { width:100%; border-collapse: collapse; margin-top:12px; }
    th, td { border-bottom:1px solid #eee; padding:8px; font-size:13px; }
    th { text-align:left; background:#fafafa; }
    .tot { display:flex; justify-content:space-between; margin-top:14px; font-weight:700; }
    .btns { margin-top:14px; display:flex; gap:10px; flex-wrap:wrap; }
    button { padding:10px 12px; border:0; border-radius:10px; cursor:pointer; font-weight:700; }
    .print { background:#111; color:#fff; }
    .close { background:#eee; }
    @media print {
      body { background:#fff; padding:0; }
      .btns { display:none; }
      .card { border:0; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>Recibo (Boleta Simple)</h1>
    <div class="muted">
      Pedido: <b>#${esc(pedidoVisual)}</b><br/>
      Fecha: ${esc(fecha.toLocaleString())}<br/>
      ${note ? `Nota: ${esc(note)}<br/>` : ""}
      <b>Comprobante interno sin valor fiscal (no SUNAT)</b>
    </div>

    <table>
      <thead>
        <tr>
          <th>Ítem</th>
          <th style="text-align:center">Cant.</th>
          <th style="text-align:right">P.Unit</th>
          <th style="text-align:right">Importe</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="tot">
      <span>Total</span>
      <span>S/ ${Number(total || 0).toFixed(2)}</span>
    </div>

    <div class="btns">
      <button class="print" onclick="window.print()">Guardar/Imprimir (PDF)</button>
      <button class="close" onclick="window.close()">Cerrar</button>
    </div>
  </div>
</body>
</html>`;
}

/* ===================== APISPERU ===================== */

async function fetchCpePdfFromApisPeru({ restaurantId, raw_request }) {
  if (!APISPERU_BASE) throw new Error("APISPERU_BASE no está configurado.");

  const emisor = await getEmisorByRestaurant(restaurantId);
  const tk =
    String(emisor?.apiperu_company_token || "").trim() ||
    APISPERU_FALLBACK_TOKEN;

  if (!tk) {
    throw new Error(
      "No hay token de ApisPerú (sunat_emisores.apiperu_company_token ni APISPERU_FALLBACK_TOKEN)."
    );
  }

  if (!raw_request) throw new Error("CPE sin raw_request.");

  const r = await axios.post(`${APISPERU_BASE}/invoice/pdf`, raw_request, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tk}`,
    },
    responseType: "arraybuffer",
    timeout: 30000,
    validateStatus: () => true,
  });

  if (r.status >= 200 && r.status < 300) return r.data;

  let msg = `ApisPerú respondió ${r.status}`;
  try {
    msg += `: ${Buffer.from(r.data || []).toString("utf8").slice(0, 300)}`;
  } catch {}
  throw new Error(msg);
}

/* ===================== Handlers internos (sin router.handle raro) ===================== */

async function handleCpePdf(req, res, pedidoId, pedPreloaded = null) {
  const ped = pedPreloaded || (await getPedidoById(pedidoId));
  if (!ped) return jsonError(res, 404, "Pedido no encontrado");

  if (!ped.cpe_id) {
    return jsonError(res, 404, "Este pedido no tiene CPE (probablemente es boleta simple).");
  }

  const cpe = await getCpeById(ped.cpe_id);
  if (!cpe) return jsonError(res, 404, "CPE no encontrado");

  if (cpe.pdf_url) return res.redirect(cpe.pdf_url);

  if (!cpe.raw_request) {
    return jsonError(res, 409, "CPE sin raw_request. Re-emitir o corregir cpe_id del pedido.", {
      pedidoId,
      cpeId: cpe.id,
    });
  }

  const pdfBuf = await fetchCpePdfFromApisPeru({
    restaurantId: ped.restaurant_id || cpe.restaurant_id,
    raw_request: cpe.raw_request,
  });

  return sendPdfInline(res, pdfBuf, `CPE-${pedidoId}.pdf`);
}

async function handleReciboPdf(req, res, pedidoId, pedPreloaded = null) {
  // 1) si ya existe en cpe_documents, devolvemos eso
  const doc = await getReciboSimpleByPedidoId(pedidoId);

  if (doc?.pdf_url) return res.redirect(doc.pdf_url);

  if (doc?.raw_request) {
    if (typeof doc.raw_request === "string") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(doc.raw_request);
    }
    // jsonb object (debug útil)
    return res.status(200).json({ ok: true, raw_request: doc.raw_request });
  }

  // 2) si NO existe, lo generamos desde la BD y lo guardamos
  const pedFull = pedPreloaded ? await getPedidoFull(pedidoId) : await getPedidoFull(pedidoId);
  if (!pedFull) return jsonError(res, 404, "Pedido no encontrado");

  const { rows } = await getPedidoItems(pedidoId);
  const items = normalizeItems(rows);

  const html = buildReciboHtml({ ped: pedFull, items });

  // Guardar para futuras descargas:
  // OJO: en cpe_documents suelen ser NOT NULL: tipo_doc, serie, correlativo.
  const serie = "R001";
  const correlativo = pickNumber(pedFull, ["order_no", "numero", "pedido_numero", "id"], Number(pedidoId));

  const restaurantId = Number(pedFull.restaurant_id || pedFull.restaurantId || 0) || null;
  const total = pickNumber(pedFull, ["total", "monto_total", "importe_total", "amount"], 0);
  const fecha_emision = pedFull.created_at || new Date().toISOString();

  try {
    await supabase.from("cpe_documents").upsert(
      [
        {
          restaurant_id: restaurantId,
          pedido_id: Number(pedidoId),
          tipo_doc: "00",
          serie,
          correlativo,
          fecha_emision,
          moneda: "PEN",
          subtotal: null,
          igv: null,
          total,
          estado: "INTERNO",
          raw_request: html, // se guarda como jsonb-string o text según tu esquema
          raw_response: null,
          pdf_url: null,
        },
      ],
      { onConflict: "pedido_id" }
    );
  } catch (e) {
    console.warn("[recibo] No se pudo guardar cpe_documents (igual devolvemos HTML):", e.message);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}

/* ===================== Rutas públicas ===================== */

/**
 * GET /public/restaurants/:id/settings
 */
router.get("/public/restaurants/:id/settings", async (req, res) => {
  try {
    noStore(res);

    const restaurantId = Number(req.params.id);
    if (!restaurantId) return jsonError(res, 400, "restaurantId inválido");

    const emisor = await getEmisorByRestaurant(restaurantId);

    const { data: rest, error } = await supabase
      .from("restaurantes")
      .select("billing_mode")
      .eq("id", restaurantId)
      .maybeSingle();
    if (error) throw error;

    const billingMode = String(rest?.billing_mode || "none").toLowerCase();

    const settings = {
      billingMode, // 'sunat' | 'simple' | 'none' (tu front usa allowSunat=billingMode==='sunat')
      defaultComprobante: "03",
      series: {
        "01": emisor.factura_serie || "F001",
        "03": emisor.boleta_serie || "B001",
      },
      company: {
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial || emisor.razon_social,
        address: {
          ubigeo: emisor.ubigeo || "",
          departamento: emisor.departamento || "",
          provincia: emisor.provincia || "",
          distrito: emisor.distrito || "",
          direccion: emisor.direccion || "",
          urbanizacion: emisor.urbanizacion || "",
        },
      },
    };

    return res.json({ ok: true, settings });
  } catch (e) {
    return jsonError(res, 404, e.message);
  }
});

/**
 * GET /public/pedidos/:id/cpe/pdf
 */
router.get("/public/pedidos/:id/cpe/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    return await handleCpePdf(req, res, pedidoId, ped);
  } catch (e) {
    console.error("[public.cpe.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

/**
 * GET /public/pedidos/:id/recibo/pdf
 * ✅ Si no existe, lo genera y lo guarda.
 */
router.get("/public/pedidos/:id/recibo/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    return await handleReciboPdf(req, res, pedidoId);
  } catch (e) {
    console.error("[public.recibo.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

/**
 * GET /public/pedidos/:id/comprobante/pdf
 * - Si tiene cpe_id -> CPE
 * - Si no -> recibo simple (y si no existe, lo genera)
 */
router.get("/public/pedidos/:id/comprobante/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return jsonError(res, 404, "Pedido no encontrado");

    if (ped.cpe_id) return await handleCpePdf(req, res, pedidoId, ped);
    return await handleReciboPdf(req, res, pedidoId, ped);
  } catch (e) {
    console.error("[public.comprobante.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

module.exports = router;
