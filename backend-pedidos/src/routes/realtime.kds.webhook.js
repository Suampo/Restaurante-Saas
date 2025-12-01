// backend-pedidos/src/routes/realtime.kds.webhook.js
import { Router } from "express";
import { pool } from "../config/db.js";
import { emitPedidoPagadoCompleto } from "../services/realtimeService.js";

const router = Router();

// Opcional: token interno para proteger el webhook
const INTERNAL_KDS_TOKEN = (process.env.INTERNAL_KDS_TOKEN || "").trim();

/**
 * Webhook interno: aviso "pedido pagado" desde backend-facturación.
 *
 * POST /api/webhooks/kds/pedido-pagado
 * body: { restaurantId, pedidoId }
 */
router.post("/api/webhooks/kds/pedido-pagado", async (req, res) => {
  try {
    // 🔐 Si configuraste INTERNAL_KDS_TOKEN, validamos el header
    if (INTERNAL_KDS_TOKEN) {
      const headerToken = (req.get("x-internal-token") || "").trim();
      if (headerToken !== INTERNAL_KDS_TOKEN) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const { restaurantId, pedidoId } = req.body || {};
    const rid = Number(restaurantId);
    const pid = Number(pedidoId);

    if (!rid || !pid) {
      return res
        .status(400)
        .json({ error: "restaurantId y pedidoId requeridos" });
    }

    // 1) Aseguramos que el pedido esté en 'pagado' (idempotente)
    await pool.query(
      `UPDATE pedidos
         SET estado = 'pagado', updated_at = now()
       WHERE id = $1 AND restaurant_id = $2`,
      [pid, rid]
    );

    // 2) Construimos el payload completo y lo emitimos al KDS
    await emitPedidoPagadoCompleto(rid, pid);

    return res.json({ ok: true });
  } catch (e) {
    console.error("[webhook KDS] pedido-pagado error:", e.message);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
