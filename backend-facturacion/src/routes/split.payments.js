// backend-facturacion/src/routes/split.payments.js
const express = require("express");
const crypto = require("crypto");
const router = express.Router();

const { supabase } = require("../services/supabase");
const { reservarCorrelativo } = require("../services/series");
const { emitirInvoice, getEmisorByRestaurant } = require("../services/facturador");
const { getPedidoCompleto, buildCPE, nowLimaISO } = require("../services/cpe");

const CASH_SALT = (process.env.CASH_PIN_SALT || "cashpin.salt").trim();

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function hashPin(pin, restaurantId) {
  return sha256(`${String(pin || "")}::${String(restaurantId)}::${CASH_SALT}`);
}

async function getSaldo(pedidoId) {
  const { data: ped } = await supabase
    .from("pedidos")
    .select("id, total, restaurant_id, estado, cpe_id, comprobante_tipo, billing_client, billing_email")
    .eq("id", Number(pedidoId)).maybeSingle();
  if (!ped) throw new Error("Pedido no encontrado");

  const { data: rows } = await supabase
    .from("pagos")
    .select("monto, estado")
    .eq("pedido_id", ped.id);

  const pagado = (rows || [])
    .filter(r => String(r.estado || "").toLowerCase() === "approved")
    .reduce((s, r) => s + Number(r.monto || 0), 0);

  const pendiente = Math.max(0, Number(ped.total || 0) - pagado);
  return { pedido: ped, pagado, pendiente };
}

/** Marca pedido pagado si la suma aprobada >= total y emite CPE si corresponde */
async function recomputeAndEmitIfPaid(pedidoId) {
  const { pedido, pagado, pendiente } = await getSaldo(pedidoId);
  if (pendiente > 0.01) return { ok: true, status: "partial", pagado, pendiente };

  // idempotente
  if (pedido.estado !== "pagado") {
    await supabase.from("pedidos")
      .update({ estado: "pagado", updated_at: new Date().toISOString() })
      .eq("id", pedido.id);
  }

  // Si ya tiene CPE o el restaurante no factura SUNAT, salimos
  const rid = Number(pedido.restaurant_id || 0);
  const { data: rest } = await supabase
    .from("restaurantes").select("billing_mode").eq("id", rid).maybeSingle();
  const billingMode = rest?.billing_mode || "none";
  if (pedido.cpe_id || billingMode !== "sunat") {
    return { ok: true, status: "paid", pagado, pendiente: 0 };
  }

  // ===== EMISIÓN SUNAT (misma lógica que tu webhook.mp) =====
  const comprobanteTipo = String(pedido.comprobante_tipo || "03");
  const { pedido: pedFull, detalles } = await getPedidoCompleto(pedido.id);

  const billing = (pedFull.billing_client && Object.keys(pedFull.billing_client).length > 0)
    ? pedFull.billing_client
    : { tipoDoc: "1", numDoc: "00000000", nombres: "CLIENTE" };

  const emisor = await getEmisorByRestaurant(rid);
  const { serie, correlativo } = await reservarCorrelativo(rid, comprobanteTipo);
  const { body: cpeBody, totals } = buildCPE({
    tipoDoc: comprobanteTipo,
    serie, correlativo,
    fechaEmisionISO: nowLimaISO(),
    emisor, billing,
    detalles, pedido: pedFull,
  });

  const { data: ins } = await supabase.from("cpe_documents").insert([{
    restaurant_id: rid, pedido_id: pedido.id, tipo_doc: comprobanteTipo,
    serie, correlativo, moneda: "PEN",
    subtotal: Number(totals?.valorVenta ?? 0),
    igv: Number(totals?.mtoIGV ?? 0),
    total: Number(totals?.mtoImpVenta ?? 0),
    estado: "PENDIENTE", raw_request: cpeBody, client: billing,
  }]).select("id").maybeSingle();
  const cpeId = ins?.id;

  let estado = "ENVIADO", pdf_url = null, xml_url = null, cdr_url = null, hash = null, digest = null, ticket = null, notas = null;
  try {
    const resp = await emitirInvoice({ restaurantId: rid, cpeBody });
    const success = resp?.accepted || resp?.sunatResponse?.success || !!resp?.cdrZip;
    const hasErr  = !!(resp?.error || resp?.sunatResponse?.error);
    estado = success ? "ACEPTADO" : (hasErr ? "RECHAZADO" : "ENVIADO");
    notas  = resp?.sunatResponse?.error?.message || resp?.error?.message || null;
    hash   = resp?.hash || resp?.digestValue || null;
    digest = resp?.digestValue || resp?.hash || null;
    ticket = resp?.ticket || null;

    // archivos (si vinieran en base64; opcional)
    try {
      const base = `${emisor.ruc}/${serie}-${String(correlativo).padStart(8, "0")}`;
      const save = async (key, b64, mime) => {
        if (!b64) return null;
        const bytes = Buffer.from(b64, "base64");
        const { error } = await supabase.storage.from(process.env.CPE_BUCKET || "cpe")
          .upload(`${base}${key}`, bytes, { upsert: true, contentType: mime });
        if (error) return null;
        const { data: pub } = supabase.storage.from(process.env.CPE_BUCKET || "cpe").getPublicUrl(`${base}${key}`);
        return pub?.publicUrl || null;
      };
      xml_url = await save(".zip", resp?.xmlZipBase64 || resp?.xml, "application/zip");
      cdr_url = await save("-cdr.zip", resp?.cdrZipBase64 || resp?.cdrZip, "application/zip");
    } catch {}
  } catch (e) {
    estado = "RECHAZADO";
    notas = e?.message || "Error emitiendo";
  }

  await supabase.from("cpe_documents").update({
    estado, xml_url, pdf_url, cdr_url, hash, digest,
    sunat_ticket: ticket, sunat_notas: notas,
  }).eq("id", cpeId);

  await supabase.from("pedidos").update({
    cpe_id: cpeId, sunat_estado: estado,
  }).eq("id", pedido.id);

  return { ok: true, status: "paid", pagado, pendiente: 0, cpeId, estado };
}

/* ---------- ENDPOINTS ---------- */

/** GET saldo del pedido */
router.get("/pedidos/:id/saldo", async (req, res) => {
  try {
    const r = await getSaldo(Number(req.params.id));
    res.json({ total: Number(r.pedido.total), pagado: r.pagado, pendiente: r.pendiente });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** POST crea un pago en EFECTIVO pendiente de aprobación */
router.post("/pedidos/:id/pagos/efectivo", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);
    const amount = Number(req.body?.amount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: "Monto inválido" });

    const { pedido, pendiente } = await getSaldo(pedidoId);
    if (amount - pendiente > 0.01) {
      return res.status(400).json({ error: "El monto excede el saldo pendiente" });
    }

    const { data, error } = await supabase.from("pagos").insert([{
      pedido_id: pedidoId,
      restaurant_id: Number(pedido.restaurant_id) || null,
      monto: amount,
      metodo: "efectivo",
      estado: "pending",
      currency: "PEN",
      psp: "cash",
      psp_payload: { source: "cash", note: "pendiente de aprobación" }
    }]).select("id").maybeSingle();
    if (error) throw error;

    res.status(201).json({ pagoId: data.id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** POST aprobar un pago en efectivo con PIN (mozo/dueño) */
router.post("/pedidos/:id/pagos/:pagoId/aprobar", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const pedidoId = Number(req.params.id);
    const pagoId = Number(req.params.pagoId);
    const pin = String(req.body?.pin || "");

    if (!pin || !pagoId) return res.status(400).json({ error: "PIN y pagoId requeridos" });

    const { data: pago } = await supabase.from("pagos")
      .select("id, pedido_id, restaurant_id, estado")
      .eq("id", pagoId).maybeSingle();
    if (!pago || pago.pedido_id !== pedidoId) return res.status(404).json({ error: "Pago no encontrado" });
    if (String(pago.estado).toLowerCase() === "approved") {
      const r = await recomputeAndEmitIfPaid(pedidoId);
      return res.json({ ok: true, already: true, ...r });
    }

    const rid = Number(pago.restaurant_id || 0);
    const { data: rest } = await supabase.from("restaurantes")
      .select("cash_pin_hash").eq("id", rid).maybeSingle();
    if (!rest?.cash_pin_hash) return res.status(409).json({ error: "PIN no configurado" });

    const ok = rest.cash_pin_hash === hashPin(pin, rid);
    if (!ok) return res.status(403).json({ error: "PIN inválido" });

    await supabase.from("pagos").update({
      estado: "approved",
      approved_at: new Date().toISOString(),
      approved_by: "pin",
    }).eq("id", pagoId);

    const out = await recomputeAndEmitIfPaid(pedidoId);
    res.json({ ok: true, ...out });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** POST set/replace del PIN del restaurante (hazlo detrás de tu auth de admin) */
router.post("/restaurantes/:rid/cash-pin", express.json({ type: "*/*" }), async (req, res) => {
  try {
    const rid = Number(req.params.rid);
    const pin = String(req.body?.pin || "").replace(/\D+/g, "").slice(0, 6);
    if (!pin || pin.length < 4) return res.status(400).json({ error: "PIN inválido (mínimo 4 dígitos)" });

    const h = hashPin(pin, rid);
    await supabase.from("restaurantes").update({
      cash_pin_hash: h, cash_pin_updated_at: new Date().toISOString()
    }).eq("id", rid);

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
module.exports.recomputeAndEmitIfPaid = recomputeAndEmitIfPaid;