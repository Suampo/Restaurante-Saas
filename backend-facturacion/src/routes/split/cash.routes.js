// backend-facturacion/src/routes/split/cash.routes.js
"use strict";

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { supabase } = require("../../services/supabase");
const { getAuthUser } = require("../../utils/authUser");
const { recomputeAndEmitIfPaid } = require("../../services/split/recompute");

const CASH_SALT = (process.env.CASH_PIN_SALT || "cashpin.salt").trim();

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/**
 * GET saldo del pedido
 */
router.get("/pedidos/:pedidoId/saldo", async (req, res) => {
  const { pedidoId } = req.params;

  const { data, error } = await supabase.rpc("get_saldo_pedido", {
    pedidoid: Number(pedidoId)
  });

  if (error) return res.status(400).json({ error: error.message });
  return res.json(data);
});

/**
 * POST crear pago en efectivo (pending)
 */
router.post("/pedidos/:pedidoId/pagos/efectivo", async (req, res) => {
  const { pedidoId } = req.params;
  const { amount, received, note } = req.body;

  const rid = Number(req.headers["x-restaurant-id"]);
  if (!rid) return res.status(400).json({ error: "RestaurantId faltante" });

  // 1. validar que NO haya un pending payment
  const { data: existing } = await supabase
    .from("pagos")
    .select("id")
    .eq("pedido_id", pedidoId)
    .eq("estado", "pending")
    .maybeSingle();

  if (existing) {
    return res.json({
      pendingPaymentId: existing.id,
      ok: true
    });
  }

  // 2. insertar pago
  const { data, error } = await supabase
    .from("pagos")
    .insert({
      pedido_id: pedidoId,
      method: "cash",
      amount,
      cash_received: received,
      note,
      estado: "pending",
      restaurant_id: rid
    })
    .select("id")
    .single();

  if (error) return res.status(400).json({ error: error.message });

  return res.json({
    ok: true,
    pagoId: data.id
  });
});

/**
 * POST aprobar pago en efectivo
 */
router.post("/pedidos/:pedidoId/pagos/:pagoId/aprobar", async (req, res) => {
  const { pedidoId, pagoId } = req.params;
  const { pin, received, note } = req.body;

  const rid = Number(req.headers["x-restaurant-id"]);
  if (!rid) return res.status(400).json({ error: "RestaurantId faltante" });

  // 1. validar PIN del restaurante
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("cash_pin_hash")
    .eq("id", rid)
    .single();

  const hash = sha256(`${pin}::${rid}::${CASH_SALT}`);
  if (!restaurant || restaurant.cash_pin_hash !== hash) {
    return res.status(403).json({ error: "PIN incorrecto" });
  }

  // 2. identidad del mozo (firmar pago)
  const user = getAuthUser(req); // viene de requireWaiter()
  if (!user) {
    return res.status(403).json({ error: "Sesión inválida" });
  }

  // 3. actualizar pago
  const { error: updErr } = await supabase
    .from("pagos")
    .update({
      estado: "approved",
      cash_received: received,
      note,
      approved_at: new Date().toISOString(),
      approved_by_user_id: user.id,
      approved_by_user_email: user.email,
      approved_by_role: "waiter"
    })
    .eq("id", pagoId);

  if (updErr) return res.status(400).json({ error: updErr.message });

  // 4. recomputar saldo y emitir CPE si aplica
  const out = await recomputeAndEmitIfPaid(pedidoId, rid);

  return res.json({
    ok: true,
    status: out.status,
    pedidoId,
    pagoId
  });
});

module.exports = router;
