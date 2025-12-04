const { supabase } = require("../supabase");
const { emitirInvoice } = require("../facturador");

async function recomputeAndEmitIfPaid(pedidoId) {
  const { data: saldo, error } = await supabase.rpc("get_saldo_pedido", {
    pedidoid: Number(pedidoId),
  });

  if (error) {
    console.error("Error recalculando saldo:", error.message);
    return "error";
  }

  // Si queda saldo → pago parcial
  if (saldo.pendiente > 0.01) {
    return "partial";
  }

  // Está completamente pagado → emitir comprobante
  try {
    await emitirInvoice(pedidoId);
  } catch (e) {
    console.error("Error emitiendo CPE:", e.message);
  }

  return "paid";
}

module.exports = {
  recomputeAndEmitIfPaid,
};
