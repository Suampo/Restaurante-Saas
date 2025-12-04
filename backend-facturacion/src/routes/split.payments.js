// backend-facturacion/src/routes/split.payments.js
"use strict";

const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const axios = require("axios");
const { PEDIDOS_URL, INTERNAL_KDS_TOKEN } = process.env;
const { getAuthUser } = require("../utils/authUser");
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

/**
 * Avisar al backend-pedidos para que el KDS reciba un evento de "pedido_pagado".
 * Usa PEDIDOS_URL + INTERNAL_KDS_TOKEN (si está configurado).
 */
async function notifyKdsPedidoPagado(restaurantId, pedidoId) {
  try {
    const base = (PEDIDOS_URL || "").trim();
    if (!base) return; // si no configuras PEDIDOS_URL, simplemente no avisa

    const url = `${base.replace(/\/+$/, "")}/api/webhooks/kds/pedido-pagado`;

    const headers = { "Content-Type": "application/json" };
    if (INTERNAL_KDS_TOKEN) {
      headers["x-internal-token"] = INTERNAL_KDS_TOKEN;
    }

    await axios.post(
      url,
      { restaurantId, pedidoId },
      { headers, timeout: 10000 }
    );
  } catch (e) {
    console.warn("[notifyKdsPedidoPagado] warn:", e.message);
  }
}

/* ------------------------------- Helpers ------------------------------- */

async function getSaldo(pedidoId) {
  const { data: ped, error: ePed } = await supabase
    .from("pedidos")
    .select(
      "id, total, restaurant_id, estado, cpe_id, comprobante_tipo, billing_client, billing_email, sunat_estado"
    )
    .eq("id", Number(pedidoId))
    .maybeSingle();
  if (ePed) throw new Error(ePed.message);
  if (!ped) throw new Error("Pedido no encontrado");

  const { data: rows, error: ePag } = await supabase
    .from("pagos")
    .select("monto, estado")
    .eq("pedido_id", ped.id);
  if (ePag) throw new Error(ePag.message);

  const pagado = (rows || [])
    .filter((r) => String(r.estado || "").toLowerCase() === "approved")
    .reduce((s, r) => s + Number(r.monto || 0), 0);

  const pendiente = Math.max(0, Number(ped.total || 0) - pagado);
  return { pedido: ped, pagado, pendiente };
}
async function recomputeAndEmitIfPaid(pedidoId) {
  const { pedido, pagado, pendiente } = await getSaldo(pedidoId);

  if (pendiente > 0.01) {
    return { ok: true, status: "partial", pagado, pendiente };
  }

  // Marcar pedido pagado
  if (pedido.estado !== "pagado") {
    await supabase
      .from("pedidos")
      .update({ estado: "pagado", updated_at: new Date().toISOString() })
      .eq("id", pedido.id);
  }

  const rid = Number(pedido.restaurant_id || 0);

  // Revisar si hay que emitir CPE
  const { data: rest } = await supabase
    .from("restaurantes")
    .select("billing_mode")
    .eq("id", rid)
    .maybeSingle();

  const billingMode = rest?.billing_mode || "none";
  let cpeId = pedido.cpe_id || null;
  let estadoCpe = pedido.sunat_estado || null;

  // Si ya existe CPE o no es modo SUNAT → solo avisar KDS
  if (cpeId || billingMode !== "sunat") {
    try {
      if (rid) {
        await notifyKdsPedidoPagado(rid, pedido.id);
      }
    } catch (e) {
      console.warn("[recomputeAndEmitIfPaid] notifyKdsPedidoPagado:", e.message);
    }

    return {
      ok: true,
      status: "paid",
      pagado,
      pendiente: 0,
      cpeId,
      estado: estadoCpe || "NO_EMITIDO",
    };
  }

  // Emitir CPE SUNAT
  try {
    const full = await getPedidoCompleto(pedido.id);
    const emisor = await getEmisorByRestaurant(rid);

    const xml = await buildCPE(full, emisor, nowLimaISO());
    const stored = await emitirInvoice(xml, rid);

    cpeId = stored.cpeId;
    estadoCpe = stored.estado;

    await supabase
      .from("pedidos")
      .update({ cpe_id: cpeId, sunat_estado: estadoCpe })
      .eq("id", pedido.id);

  } catch (e) {
    console.warn("[recomputeAndEmitIfPaid] CPE error:", e.message);
  }

  // Avisar al KDS
  try {
    if (rid) {
      await notifyKdsPedidoPagado(rid, pedido.id);
    }
  } catch (e) {
    console.warn("[recomputeAndEmitIfPaid] notifyKdsPedidoPagado:", e.message);
  }

  return {
    ok: true,
    status: "paid",
    pagado,
    pendiente: 0,
    cpeId,
    estado: estadoCpe || "NO_EMITIDO",
  };
}

/** Inserta movimiento de caja (no bloquea si falla, pero deja log) */
async function insertCashMovement({
  restaurantId,
  pagoId,
  amount,
  createdBy,
  note,
}) {
  try {
    if (!restaurantId || !pagoId) return;
    await supabase.from("cash_movements").insert([
      {
        restaurant_id: Number(restaurantId),
        drawer_id: null,
        pago_id: Number(pagoId),
        type: "in",
        amount: Number(amount || 0),
        created_by: createdBy || null,
        note: note || null,
      },
    ]);
  } catch (e) {
    console.warn("[cash_movements.insert] warning:", e?.message);
  }
}

/* ------------------------------- Endpoints ------------------------------ */

/** GET saldo del pedido */
router.get("/pedidos/:id/saldo", async (req, res) => {
  try {
    const r = await getSaldo(Number(req.params.id));
    res.json({
      total: Number(r.pedido.total),
      pagado: r.pagado,
      pendiente: r.pendiente,
    });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/** POST crea un pago en EFECTIVO pendiente (recibido/nota opcional) */
router.post(
  "/pedidos/:id/pagos/efectivo",
  express.json({ type: "*/*" }),
  async (req, res) => {
    try {
      const pedidoId = Number(req.params.id);
      const amount = Number(req.body?.amount || 0);
      const cashReceived =
        req.body?.received != null ? Number(req.body.received) : null;
      const note = String(req.body?.note || "").slice(0, 250);

      if (!(amount > 0))
        return res.status(400).json({ error: "Monto inválido" });

      const { pedido, pendiente } = await getSaldo(pedidoId);
      if (amount - pendiente > 0.01) {
        return res
          .status(400)
          .json({ error: "El monto excede el saldo pendiente" });
      }

      // 🚫 FIX 1 — NO PERMITIR DUPLICAR PAGOS PENDING
      const { data: existingPending } = await supabase
        .from("pagos")
        .select("id")
        .eq("pedido_id", pedidoId)
        .eq("estado", "pending")
        .maybeSingle();

      if (existingPending) {
        return res.status(409).json({
          error:
            "Ya existe un pago pendiente. Aprobalo o elimínalo antes de crear otro.",
          pendingPaymentId: existingPending.id,
        });
      }

      const change =
        cashReceived != null && cashReceived > amount
          ? cashReceived - amount
          : 0;

      const { data, error } = await supabase
        .from("pagos")
        .insert([
          {
            pedido_id: pedidoId,
            restaurant_id: Number(pedido.restaurant_id) || null,
            monto: amount,
            metodo: "efectivo",
            estado: "pending",
            currency: "PEN",
            psp: "cash",
            psp_payload: { source: "cash", note: "pendiente de aprobación" },
            cash_received: cashReceived,
            cash_change: change,
            cash_note: note,
          },
        ])
        .select("id")
        .maybeSingle();

      if (error) throw error;

      res.status(201).json({ pagoId: data.id });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

/** POST aprobar pago en efectivo con PIN (usa headers x-app-user / x-app-user-id) */
router.post(
  "/pedidos/:id/pagos/:pagoId/aprobar",
  express.json({ type: "*/*" }),
  async (req, res) => {
    try {
      const pedidoId = Number(req.params.id);
      const pagoId = Number(req.params.pagoId);
      const pin = String(req.body?.pin || "");
      const received =
        req.body?.received != null ? Number(req.body.received) : null;
      const note = String(req.body?.note || "").slice(0, 250);

      if (!pin || !pagoId)
        return res
          .status(400)
          .json({ error: "PIN y pagoId requeridos" });

      // Traer pago y validar que sea efectivo/cash
      const { data: pago } = await supabase
        .from("pagos")
        .select(
          "id, pedido_id, restaurant_id, estado, monto, metodo, psp, cash_received, cash_change"
        )
        .eq("id", pagoId)
        .maybeSingle();

      if (!pago || pago.pedido_id !== pedidoId)
        return res.status(404).json({ error: "Pago no encontrado" });

      const estadoLower = String(pago.estado || "").toLowerCase();
      if (estadoLower === "approved") {
        const r = await recomputeAndEmitIfPaid(pedidoId);
        return res.json({ ok: true, already: true, ...r });
      }

      const metodo = String(pago.metodo || "").toLowerCase();
      const psp = String(pago.psp || "").toLowerCase();
      if (metodo !== "efectivo" || psp !== "cash") {
        return res
          .status(400)
          .json({ error: "Solo se puede aprobar pagos en efectivo (psp=cash)" });
      }

      const rid = Number(pago.restaurant_id || 0);
      const { data: rest } = await supabase
        .from("restaurantes")
        .select("cash_pin_hash")
        .eq("id", rid)
        .maybeSingle();
      if (!rest?.cash_pin_hash)
        return res.status(409).json({ error: "PIN no configurado" });

      const ok = rest.cash_pin_hash === hashPin(pin, rid);
      if (!ok) return res.status(403).json({ error: "PIN inválido" });

      // Quién aprueba (prioridad: headers del front → usuario supabase → "pin")
      const headerEmail = (req.get("x-app-user") || "").trim();
      const headerUserId = (req.get("x-app-user-id") || "").trim() || null;
      const user = await getAuthUser(req); // puede ser null si no usas Supabase Auth
      const whoEmail = headerEmail || user?.email || "pin";
      const whoUserId = headerUserId || user?.id || null; // uuid

      // Recalcular cash_received/cash_change si llega "received" ahora
      let cash_received = pago.cash_received;
      let cash_change = pago.cash_change;
      if (received != null && received >= 0) {
        cash_received = received;
        cash_change =
          received > Number(pago.monto || 0)
            ? received - Number(pago.monto || 0)
            : 0;
      }

      // 1) UPDATE pagos
      await supabase
        .from("pagos")
        .update({
          estado: "approved",
          approved_at: new Date().toISOString(),
          approved_by: whoEmail,
          approved_by_user_id: whoUserId, // 👈 clave para dashboard de Trabajadores
          cash_received,
          cash_change,
          cash_note: note || null,
        })
        .eq("id", pagoId);

      // 2) INSERT movimiento de caja (no bloquear si falla)
      await insertCashMovement({
        restaurantId: rid,
        pagoId,
        amount: Number(pago.monto || 0),
        createdBy: whoUserId,
        note,
      });

      // 3) Recomputar y emitir CPE si corresponde + avisar al KDS
      const out = await recomputeAndEmitIfPaid(pedidoId);
      res.json({ ok: true, ...out });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

/** POST set/replace del PIN del restaurante */
router.post(
  "/restaurantes/:rid/cash-pin",
  express.json({ type: "*/*" }),
  async (req, res) => {
    try {
      const rid = Number(req.params.rid);
      const pin = String(req.body?.pin || "")
        .replace(/\D+/g, "")
        .slice(0, 6);
      if (!pin || pin.length < 4)
        return res
          .status(400)
          .json({ error: "PIN inválido (mínimo 4 dígitos)" });

      const h = hashPin(pin, rid);
      await supabase
        .from("restaurantes")
        .update({
          cash_pin_hash: h,
          cash_pin_updated_at: new Date().toISOString(),
        })
        .eq("id", rid);

      res.json({ ok: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  }
);

module.exports = router;
