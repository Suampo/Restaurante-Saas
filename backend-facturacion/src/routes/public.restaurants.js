"use strict";

const express = require("express");
const axios = require("axios");
const router = express.Router();

const { getEmisorByRestaurant } = require("../services/facturador");
const { supabase } = require("../services/supabase");

const APISPERU_BASE = (process.env.APISPERU_BASE || "").trim();
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

function formatLima(dateInput) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

function pickNumber(obj, keys, fallback = 0) {
  for (const k of keys) {
    const n = Number(obj?.[k]);
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

function tryParseJson(v) {
  if (v == null) return null;
  if (typeof v === "object") return v;
  if (typeof v !== "string") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

/* ===================== DB Queries ===================== */

async function getPedidoById(pedidoId) {
  const { data: ped, error } = await supabase
    .from("pedidos")
    .select("id, restaurant_id, cpe_id, order_no, total, created_at, note, comprobante_tipo")
    .eq("id", Number(pedidoId))
    .maybeSingle();
  if (error) throw error;
  return ped;
}

async function getPedidoFull(pedidoId) {
  const { data: ped, error } = await supabase
    .from("pedidos")
    .select("*")
    .eq("id", Number(pedidoId))
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
    .eq("pedido_id", Number(pedidoId))
    .eq("tipo_doc", "00")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function getRestaurantName(restaurantId) {
  if (!restaurantId) return "Recibo";
  try {
    const { data } = await supabase
      .from("restaurantes")
      .select("nombre, nombre_comercial")
      .eq("id", Number(restaurantId))
      .maybeSingle();
    return data?.nombre_comercial || data?.nombre || "Recibo";
  } catch {
    return "Recibo";
  }
}

/**
 * ✅ Tus tablas reales:
 * - pedido_detalle
 * - pedido_detalle_combo_items
 */
async function getPedidoItems(pedidoId) {
  // 1) detalle principal
  let detalle = [];
  {
    const { data, error } = await supabase
      .from("pedido_detalle")
      .select("*")
      .eq("pedido_id", Number(pedidoId));
    if (error) throw error;
    detalle = Array.isArray(data) ? data : [];
  }

  // 2) combos (best-effort: puede tener pedido_id o pedido_detalle_id)
  let comboItems = [];
  try {
    const { data, error } = await supabase
      .from("pedido_detalle_combo_items")
      .select("*")
      .eq("pedido_id", Number(pedidoId));
    if (!error && Array.isArray(data)) comboItems = data;
  } catch {}

  if (!comboItems.length && detalle.length) {
    const ids = detalle.map((r) => r.id).filter(Boolean);
    if (ids.length) {
      try {
        const { data, error } = await supabase
          .from("pedido_detalle_combo_items")
          .select("*")
          .in("pedido_detalle_id", ids);
        if (!error && Array.isArray(data)) comboItems = data;
      } catch {}
    }
  }

  return { detalle, comboItems };
}

function normalizeDetalle(rows) {
  return (rows || [])
    .map((r) => {
      const name = pickString(
        r,
        [
          "nombre",
          "nombre_item",
          "producto_nombre",
          "producto",
          "titulo",
          "descripcion",
          "menu_item_name",
          "item_name",
        ],
        "Item"
      );

      const qty = pickNumber(r, ["cantidad", "qty", "quantity", "cant", "units"], 1);

      const price = pickNumber(
        r,
        ["precio_unitario", "precio_unit", "precio", "price", "unit_price", "pu"],
        0
      );

      return { name, qty, price };
    })
    .filter((x) => x.qty > 0);
}

function normalizeComboItems(rows) {
  // Informativo, no suma al total (precio 0)
  return (rows || []).map((r) => {
    const name = pickString(
      r,
      ["nombre", "nombre_item", "producto_nombre", "producto", "descripcion", "titulo", "item_name"],
      "Extra"
    );
    const qty = pickNumber(r, ["cantidad", "qty", "quantity", "cant", "units"], 1);
    return { name: `↳ ${name}`, qty, price: 0 };
  });
}

// Soporte si algún día guardas items como JSON en pedidos
function extractItemsFromPedido(ped) {
  const candidates = ["items", "detalle", "order_summary", "cart", "line_items", "productos"];
  for (const key of candidates) {
    const parsed = tryParseJson(ped?.[key]);
    if (Array.isArray(parsed)) {
      return parsed.map((it) => ({
        name: it.name || it.nombre || it.title || it.descripcion || it.producto || "Item",
        qty: Number(it.qty ?? it.cantidad ?? it.quantity ?? 1),
        price: Number(it.price ?? it.precio ?? it.unit_price ?? it.pu ?? 0),
      }));
    }
  }
  return [];
}

/* ===================== HTML Recibo (Boleta Simple) ===================== */

function buildReciboHtml({ restaurantName, pedidoVisual, fechaStr, items, total, note }) {
  const rows = (items || []).length
    ? items
        .map((it) => {
          const qty = Number(it.qty || 1);
          const price = Number(it.price || 0);
          const sub = qty * price;

          return `
            <div class="row">
              <div class="left">
                <div class="name">${esc(it.name)}</div>
                <div class="meta">${qty} x ${price ? `S/ ${price.toFixed(2)}` : `—`}</div>
              </div>
              <div class="right">${price ? `S/ ${sub.toFixed(2)}` : ""}</div>
            </div>
          `;
        })
        .join("")
    : `<div class="muted">Sin ítems (no hay filas en pedido_detalle para este pedido).</div>`;

  // ✅ IMPORTANTE CSP:
  // - NO <style> inline
  // - NO onclick inline
  // - CSS y JS desde /public/assets (self)
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Recibo #${esc(pedidoVisual)}</title>

  <link rel="stylesheet" href="/public/assets/recibo.css">
  <script defer src="/public/assets/recibo.js"></script>
</head>
<body>
  <div class="wrap">
    <div class="ticket">
      <h1>${esc(restaurantName || "Recibo")}</h1>

      <div class="muted">
        Recibo (Boleta Simple)<br/>
        Pedido: <b>#${esc(pedidoVisual)}</b><br/>
        Fecha (Perú): ${esc(fechaStr)}<br/>
      </div>

      <div class="tag">Comprobante interno sin valor fiscal (no SUNAT)</div>

      ${note ? `<div class="note"><b>Nota:</b> ${esc(note)}</div>` : ""}

      <div class="hr"></div>

      ${rows}

      <div class="hr"></div>

      <div class="tot">
        <span>TOTAL</span>
        <span>S/ ${Number(total || 0).toFixed(2)}</span>
      </div>

      <div class="btns">
        <button class="p" data-action="print">Guardar/Imprimir (PDF)</button>
        <button class="c" data-action="close">Cerrar</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/* ===================== APISPERU ===================== */

async function fetchCpePdfFromApisPeru({ restaurantId, raw_request }) {
  if (!APISPERU_BASE) throw new Error("APISPERU_BASE no está configurado.");

  const emisor = await getEmisorByRestaurant(restaurantId);
  const tk = String(emisor?.apiperu_company_token || "").trim() || APISPERU_FALLBACK_TOKEN;

  if (!tk) throw new Error("No hay token de ApisPerú (DB ni APISPERU_FALLBACK_TOKEN).");
  if (!raw_request) throw new Error("CPE sin raw_request.");

  const r = await axios.post(`${APISPERU_BASE}/invoice/pdf`, raw_request, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${tk}` },
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

/* ===================== Handlers ===================== */

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

async function handleReciboPdf(req, res, pedidoId) {
  // Solo para actualizar el mismo registro si existe
  const existing = await getReciboSimpleByPedidoId(pedidoId);

  const pedFull = await getPedidoFull(pedidoId);
  if (!pedFull) return jsonError(res, 404, "Pedido no encontrado");

  const restaurantId = Number(pedFull.restaurant_id || 0) || null;
  const restaurantName = await getRestaurantName(restaurantId);

  // ✅ En tu esquema, el “número visible” es order_no
  const pedidoVisual = String(pedFull.order_no ?? pedFull.id ?? pedidoId);

  // ✅ Hora Perú
  const fechaStr = formatLima(pedFull.created_at || new Date().toISOString());
  const note = pedFull.note || "";

  // ✅ items: JSON (si existiera) -> si no: pedido_detalle + combos
  let items = extractItemsFromPedido(pedFull);

  if (!items.length) {
    const { detalle, comboItems } = await getPedidoItems(pedidoId);
    const main = normalizeDetalle(detalle);
    const combo = normalizeComboItems(comboItems);
    items = [...main, ...combo];
  }

  const total = Number(pedFull.total || 0);

  const html = buildReciboHtml({
    restaurantName,
    pedidoVisual,
    fechaStr,
    items,
    total,
    note,
  });

  // Guardar/actualizar en cpe_documents (best-effort)
  const serie = "R001";
  const correlativo = Number(pedFull.order_no || pedidoId);
  const fecha_emision = pedFull.created_at || new Date().toISOString();

  try {
    if (existing?.id) {
      await supabase
        .from("cpe_documents")
        .update({
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
          raw_request: html,
          pdf_url: null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("cpe_documents").insert([
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
          raw_request: html,
          pdf_url: null,
        },
      ]);
    }
  } catch (e) {
    console.warn("[recibo] No se pudo guardar cpe_documents (igual devolvemos HTML):", e.message);
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.status(200).send(html);
}

/* ===================== Routes ===================== */

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

    return res.json({
      ok: true,
      settings: {
        billingMode,
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
      },
    });
  } catch (e) {
    return jsonError(res, 404, e.message);
  }
});

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

router.get("/public/pedidos/:id/comprobante/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return jsonError(res, 404, "Pedido no encontrado");

    if (ped.cpe_id) return await handleCpePdf(req, res, pedidoId, ped);
    return await handleReciboPdf(req, res, pedidoId);
  } catch (e) {
    console.error("[public.comprobante.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

module.exports = router;
