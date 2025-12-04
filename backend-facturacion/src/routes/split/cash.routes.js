"use strict";

const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { supabase } = require("../../services/supabase");
const { getAuthUser } = require("../../utils/authUser");
const { recomputeAndEmitIfPaid } = require("../split.payments");

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
    pedidoid: Number(pedidoId),
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
      ok: true,
    });
  }

  const { data, error } = await supabase
    .from("pagos")
    .insert({
      pedido_id: pedidoId,
      tipo: "cash",
      estado: "pending",
      monto: amount,
      recibido: received,
      nota: note,
      restaurant_id: rid,
    })
    .select("id")
    .maybeSingle();

  if (error) return res.status(400).json({ error: error.message });

  return res.json({
    ok: true,
    pagoId: data.id,
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

  // obtener usuario que aprueba
  const user = getAuthUser(req);

  if (!user?.id) {
    return res.status(401).json({ error: "Usuario no autorizado" });
  }

  // validar PIN
  const { data: rest } = await supabase
    .from("restaurants")
    .select("cash_pin_hash")
    .eq("id", rid)
    .maybeSingle();

  const valid =
    rest?.cash_pin_hash === sha256(`${pin}::${rid}::${CASH_SALT}`);

  if (!valid) return res.status(400).json({ error: "PIN incorrecto" });

  // actualizar pago
  const { error: updateErr } = await supabase
    .from("pagos")
    .update({
      estado: "approved",
      recibido: received,
      nota: note,
      approved_by: user.email,
      approved_by_user_id: user.id,
    })
    .eq("id", pagoId);

  if (updateErr) {
    return res.status(400).json({ error: updateErr.message });
  }

  // recalcular saldo + emitir si se completó
  const status = await recomputeAndEmitIfPaid(pedidoId);

  return res.json({
    ok: true,
    status,
    approved_by: user.email,
    approved_by_user_id: user.id,
  });
});

module.exports = router;

