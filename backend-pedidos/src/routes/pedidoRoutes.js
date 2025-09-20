import { Router } from "express";
import {
  obtenerPedidos,
  crearPedido,
  actualizarPedidoEstado,
  obtenerPedidosRecientes,
  ventasPorDia,
} from "../controllers/pedidoController.js";
import { authTenant } from "../middlewares/authTenant.js";
import { authAny } from "../middlewares/authAny.js";
import { authKitchen } from "../middlewares/authKitchen.js";

const router = Router();

// ========================
// Listados para Admin/Staff
// ========================
router.get("/", authTenant, obtenerPedidos);
router.get("/admin/recent", authTenant, obtenerPedidosRecientes);
router.get("/admin/stats/sales-by-day", authTenant, ventasPorDia);

// ========================
// Listado de pedidos para cocina
// ========================
router.get("/cocina", authKitchen, obtenerPedidos);

// ========================
// ABANDONAR (anular) pedido pendiente de pago
//  - DEBE ir ANTES que PATCH "/:id"
//  - Lo dejamos con authAny para que el cliente pueda anular su pedido abierto
//    cuando regresa del flujo de pago y cambia el carrito.
// ========================
router.patch("/:id/abandonar", authAny, async (req, res) => {
  try {
    req.body = {
      ...(req.body || {}),
      estado: "anulado",
      motivo: "abandonado_por_cliente", // opcional
    };
    await actualizarPedidoEstado(req, res);
  } catch (e) {
    console.error("[pedidos/:id/abandonar]", e);
    res.status(500).json({ error: "No se pudo abandonar el pedido" });
  }
});

// ========================
// Actualización de estado (genérica)
// ========================
router.patch("/:id", authTenant, actualizarPedidoEstado);

// ========================
// Creación de pedido (cliente o admin)
// ========================
router.post("/", authAny, crearPedido);

// ========================
// Simulación: marcar pedido como pagado
// ========================
router.post("/:id/pagado", authAny, async (req, res) => {
  try {
    req.body.estado = "pagado";
    await actualizarPedidoEstado(req, res);
  } catch (e) {
    console.error("Error simulando pago:", e);
    res.status(500).json({ error: "No se pudo marcar como pagado" });
  }
});

export default router;
