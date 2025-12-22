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

async function getPedidoById(pedidoId) {
  const { data: ped, error } = await supabase
    .from("pedidos")
    .select("id, restaurant_id, cpe_id")
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
  // Recibo simple guardado en cpe_documents con tipo_doc='00'
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

async function fetchCpePdfFromApisPeru({ restaurantId, raw_request }) {
  if (!APISPERU_BASE) throw new Error("APISPERU_BASE no está configurado.");

  const emisor = await getEmisorByRestaurant(restaurantId); // token sale de sunat_emisores
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

/* ===================== SETTINGS PÚBLICO ===================== */
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
      billingMode, // 'sunat' | 'simple' | 'none'
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

/* ===================== CPE PDF PÚBLICO ===================== */
/**
 * GET /public/pedidos/:id/cpe/pdf
 */
router.get("/public/pedidos/:id/cpe/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return jsonError(res, 404, "Pedido no encontrado");

    if (!ped.cpe_id) {
      return jsonError(res, 404, "Este pedido no tiene CPE (probablemente es boleta simple).");
    }

    const cpe = await getCpeById(ped.cpe_id);
    if (!cpe) return jsonError(res, 404, "CPE no encontrado");

    if (cpe.pdf_url) return res.redirect(cpe.pdf_url);

    // 🔴 Si no hay raw_request, no podemos pedir PDF a ApisPerú
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
  } catch (e) {
    console.error("[public.cpe.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

/* ===================== RECIBO SIMPLE (BOLETA SIMPLE) ===================== */
/**
 * GET /public/pedidos/:id/recibo/pdf
 */
router.get("/public/pedidos/:id/recibo/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const doc = await getReciboSimpleByPedidoId(pedidoId);
    if (!doc) return jsonError(res, 404, "No se encontró recibo simple para este pedido.");

    if (doc.pdf_url) return res.redirect(doc.pdf_url);

    // Fallback: si raw_request es HTML guardado como string
    if (doc.raw_request) {
      if (typeof doc.raw_request === "string") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(doc.raw_request);
      }
      // Si fue jsonb (objeto), lo devolvemos para debug (mejor que [object Object])
      return res.status(200).json({ ok: true, raw_request: doc.raw_request });
    }

    return jsonError(res, 404, "Recibo simple existe pero no tiene pdf_url ni raw_request.");
  } catch (e) {
    console.error("[public.recibo.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

/* ===================== ENDPOINT UNIFICADO ===================== */
/**
 * GET /public/pedidos/:id/comprobante/pdf
 * - Si tiene cpe_id -> CPE
 * - Si no -> recibo simple
 */
router.get("/public/pedidos/:id/comprobante/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) return jsonError(res, 400, "pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return jsonError(res, 404, "Pedido no encontrado");

    if (ped.cpe_id) {
      // Reusar lógica llamando al endpoint de CPE (sin router.handle raro)
      req.params.id = String(pedidoId);
      return router.handle({ ...req, url: `/public/pedidos/${pedidoId}/cpe/pdf`, method: "GET" }, res);
    }

    req.params.id = String(pedidoId);
    return router.handle({ ...req, url: `/public/pedidos/${pedidoId}/recibo/pdf`, method: "GET" }, res);
  } catch (e) {
    console.error("[public.comprobante.pdf] error:", e);
    return jsonError(res, 500, e.message);
  }
});

module.exports = router;
