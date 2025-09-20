// src/services/realtimeService.js
import { Server } from "socket.io";
import { imprimirTicket } from "./ticketService.js";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";
let io;
const roomId = (restaurantId) => `rest-${Number(restaurantId)}`;

export const initSocket = async (server) => {
  io = new Server(server, {
    cors: {
      origin: (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .concat([
          "http://localhost:5173",
          "http://localhost:5174",
          "http://loc zalhost:5175",
          "http://127.0.0.1:5500",
        ]),
      methods: ["GET", "POST"],
    },
  });

  // 🔹 Middleware para validar token de servicio
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers["x-auth-token"];
    if (!token) return next(new Error("Falta token"));

    const secrets = [
      process.env.JWT_SERVICE_SECRET,   // tokens de servicio (KDS/Raspberry)
      process.env.SUPABASE_JWT_SECRET,           // tokens de login (admin/operador)
      "dev_service_secret",             // fallback dev
    ].filter(Boolean);

    let payload = null;
    for (const s of secrets) {
      try { payload = jwt.verify(token, s); break; } catch {}
    }
    if (!payload) return next(new Error("Token inválido"));

    // restaurantId puede venir con distintos nombres según tu login
    const rid =
      Number(payload.restaurantId ?? payload.restaurant_id ?? payload.restauranteId ?? 0) ||
      Number(socket.handshake.auth?.restaurantId ?? 0);
    if (!rid) return next(new Error("Sin restaurantId"));

    socket.restaurantId = rid;
    return next();
  });

  // 🔌 Activa adapter Redis SOLO si hay REDIS_URL y si el paquete está disponible
  if (process.env.REDIS_URL) {
    try {
      const { createAdapter } = await import("@socket.io/redis-adapter");
      const { createClient } = await import("redis");
      const pub = createClient({ url: process.env.REDIS_URL });
      const sub = pub.duplicate();
      await Promise.all([pub.connect(), sub.connect()]);
      io.adapter(createAdapter(pub, sub));
      console.log("🔌 Socket.IO usando Redis adapter");
    } catch (e) {
      console.warn(
        "⚠️ No se pudo cargar Redis adapter, continuando sin él:",
        e.message
      );
    }
  }

  io.on("connection", (socket) => {
    const rid = socket.restaurantId; // viene del token
    if (rid) {
      socket.join(roomId(rid));
      console.log(`👤 Cocina conectada a sala ${roomId(rid)}`);
    } else {
      console.log("👤 Socket conectado sin restaurantId (broadcast)");
    }

    socket.on("kitchen.ack", (data) => {
      console.log("✅ ACK cocina:", data);
    });
  });

  console.log("✅ Socket.IO inicializado");
};

/**
 * Emitir pedido a la(s) cocinas del restaurante
 * pedido debe incluir restaurant_id o restaurantId
 */
export const emitirPedidoCocina = (pedido) => {
  if (!io) return;
  const rid = pedido.restaurant_id || pedido.restaurantId;
  if (rid) {
    io.to(roomId(rid)).emit("nuevo_pedido", pedido);
  } else {
    io.emit("nuevo_pedido", pedido); // fallback
  }
  console.log("📢 Pedido emitido a cocina:", { rid, id: pedido.id });

  // Impresión en servidor (opcional)
  if (process.env.PRINT_SERVER === "true") {
    imprimirTicket(pedido).catch((e) => {
      console.error("❌ Error imprimiendo en servidor:", e.message);
    });
  }
};

export const emitPedidoPagado = (restaurantId, payload) => {
  if (!io) return;
  const rid = Number(restaurantId);
  if (rid) io.to(roomId(rid)).emit("pedido_pagado", payload);
  else io.emit("pedido_pagado", payload); // fallback broadcast
  console.log("📢 Pedido pagado:", { rid, ...payload });
};
export const emitPedidoPagadoCompleto = async (restaurantId, pedidoId) => {
  const { rows } = await pool.query(
    `SELECT 
       p.id,
       p.order_no AS numero, 
       p.estado,
       p.total AS monto,
       COALESCE(m.codigo, 'Mesa ' || p.mesa_id::text) AS mesa,
       COALESCE(
         (SELECT jsonb_agg(
                   jsonb_build_object(
                     'tipo', CASE WHEN pd.menu_item_id IS NOT NULL THEN 'item' ELSE 'combo' END,
                     'nombre', COALESCE(mi.nombre, 'Combo #' || pd.combo_id::text),
                     'cantidad', pd.cantidad,
                     'precio_unitario', pd.precio_unitario
                   )
          )
          FROM pedido_detalle pd
          LEFT JOIN menu_items mi ON mi.id = pd.menu_item_id
          WHERE pd.pedido_id = p.id
         ), '[]'::jsonb
       ) AS items
     FROM pedidos p
     JOIN mesas m ON m.id = p.mesa_id AND m.restaurant_id = p.restaurant_id
     WHERE p.restaurant_id=$1 AND p.id=$2`,
    [restaurantId, pedidoId]
  );

  if (rows.length > 0) {
    const pedido = rows[0];
    emitPedidoPagado(restaurantId, pedido);
  }
};
