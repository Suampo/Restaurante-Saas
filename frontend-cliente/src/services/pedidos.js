// src/services/pedidos.js
import API from "./axiosInstance.js";

export async function abandonarPedidoPendiente(pedidoId) {
  if (!pedidoId) return;
  try {
    await API.patch(`/pedidos/${pedidoId}/abandonar`);
  } catch (e) {
    console.warn(
      "No se pudo abandonar el pedido",
      pedidoId,
      e?.response?.data || e.message
    );
  }
}
