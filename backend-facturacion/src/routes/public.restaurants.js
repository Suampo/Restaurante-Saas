// backend-facturacion/src/routes/public.restaurants.js
const express = require("express");
const axios = require("axios");
const router = express.Router();

const { getEmisorByRestaurant } = require("../services/facturador");
const { supabase } = require("../services/supabase");

const APISPERU_BASE = (process.env.APISPERU_BASE || "").trim(); // ej. https://facturacion.apisperu.com/api/v1
const APISPERU_FALLBACK_TOKEN = (process.env.APISPERU_FALLBACK_TOKEN || "").trim();

/* ===================== Helpers ===================== */

function noStore(res) {
  res.set("Cache-Control", "no-store");
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
    .select("id, raw_request, pdf_url, tipo_doc, estado, pedido_id, restaurant_id")
    .eq("id", cpeId)
    .maybeSingle();
  if (error) throw error;
  return cpe;
}

async function getReciboSimpleByPedidoId(pedidoId) {
  // Recibo simple guardado en cpe_documents con tipo_doc='00'
  const { data, error } = await supabase
    .from("cpe_documents")
    .select("id, pdf_url, raw_request, tipo_doc, estado, pedido_id, created_at")
    .eq("pedido_id", pedidoId)
    .eq("tipo_doc", "00")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function fetchCpePdfFromApisPeru({ restaurantId, raw_request }) {
  if (!APISPERU_BASE) throw new Error("APISPERU_BASE no está configurado.");

  // Token correcto sale de sunat_emisores via getEmisorByRestaurant
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

/* ===================== SETTINGS PÚBLICO ===================== */
/**
 * GET /public/restaurants/:id/settings
 * Devuelve settings para facturación + billingMode
 */
router.get("/public/restaurants/:id/settings", async (req, res) => {
  try {
    noStore(res);

    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error("restaurantId inválido");

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

    res.json({ ok: true, settings });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

/* ===================== CPE PDF PÚBLICO ===================== */
/**
 * GET /public/pedidos/:id/cpe/pdf
 * - Si cpe.pdf_url existe -> redirect
 * - Si no -> pide PDF a ApisPerú y lo responde inline
 */
router.get("/public/pedidos/:id/cpe/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) throw new Error("pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return res.status(404).json({ ok: false, error: "Pedido no encontrado" });

    if (!ped.cpe_id) {
      return res.status(404).json({
        ok: false,
        error: "Este pedido no tiene CPE (probablemente es boleta simple).",
      });
    }

    const cpe = await getCpeById(ped.cpe_id);
    if (!cpe) return res.status(404).json({ ok: false, error: "CPE no encontrado" });

    if (cpe.pdf_url) return res.redirect(cpe.pdf_url);

    // ✅ CORRECTO: usa restaurantId del pedido (o del cpe) + raw_request
    const pdfBuf = await fetchCpePdfFromApisPeru({
      restaurantId: ped.restaurant_id || cpe.restaurant_id,
      raw_request: cpe.raw_request,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="CPE-${pedidoId}.pdf"`);
    return res.status(200).send(Buffer.from(pdfBuf));
  } catch (e) {
    console.error("[public.cpe.pdf] error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===================== RECIBO SIMPLE (BOLETA SIMPLE) ===================== */
/**
 * GET /public/pedidos/:id/recibo/pdf
 * - Busca el último cpe_documents tipo_doc='00' del pedido
 * - Si pdf_url existe -> redirect
 * - Si no existe pdf_url pero hay raw_request -> lo devuelve como HTML (fallback)
 */
router.get("/public/pedidos/:id/recibo/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) throw new Error("pedidoId inválido");

    const doc = await getReciboSimpleByPedidoId(pedidoId);
    if (!doc) {
      return res.status(404).json({
        ok: false,
        error: "No se encontró recibo simple para este pedido.",
      });
    }

    if (doc.pdf_url) return res.redirect(doc.pdf_url);

    if (doc.raw_request) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(String(doc.raw_request));
    }

    return res.status(404).json({
      ok: false,
      error: "Recibo simple existe pero no tiene pdf_url ni raw_request.",
    });
  } catch (e) {
    console.error("[public.recibo.pdf] error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

/* ===================== ENDPOINT UNIFICADO ===================== */
/**
 * GET /public/pedidos/:id/comprobante/pdf
 * - Si el pedido tiene cpe_id -> devuelve CPE
 * - Si no -> devuelve recibo simple
 */
router.get("/public/pedidos/:id/comprobante/pdf", async (req, res) => {
  try {
    noStore(res);

    const pedidoId = Number(req.params.id);
    if (!pedidoId) throw new Error("pedidoId inválido");

    const ped = await getPedidoById(pedidoId);
    if (!ped) return res.status(404).json({ ok: false, error: "Pedido no encontrado" });

    if (ped.cpe_id) {
      req.url = `/public/pedidos/${pedidoId}/cpe/pdf`;
      return router.handle(req, res);
    }

    req.url = `/public/pedidos/${pedidoId}/recibo/pdf`;
    return router.handle(req, res);
  } catch (e) {
    console.error("[public.comprobante.pdf] error:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

module.exports = router;
