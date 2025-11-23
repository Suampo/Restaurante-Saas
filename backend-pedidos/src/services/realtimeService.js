// src/services/realtimeService.js
import { Server } from "socket.io";
import { imprimirTicket } from "./ticketService.js";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

// 🔐 Normalizamos todos los secretos posibles
const SERVICE_SECRET =
  process.env.JWT_SERVICE_SECRET ||
  process.env.JWT_SECRET ||
  "dev_service_secret";

const ADMIN_SECRET =
  process.env.SUPABASE_JWT_SECRET ||
  process.env.JWT_ADMIN_SECRET ||
  process.env.JWT_SECRET ||
  "dev_admin_secret";

const CLIENT_SECRET =
  process.env.JWT_CLIENT_SECRET || ADMIN_SECRET;

let io;
const roomId = (restaurantId) => `rest-${Number(restaurantId)}`;

/* ========================
 * INIT SOCKET.IO
 * ======================== */
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
          "http://localhost:5175",
          "http://127.0.0.1:5500",
        ]),
      methods: ["GET", "POST"],
    },
  });

  // 🔹 Middleware para validar token de servicio / admin / cliente
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers["x-auth-token"];

    if (!token) {
      console.error("[socket.io] Falta token en handshake");
      return next(new Error("Falta token"));
    }

    // Probamos con TODOS los secretos que tu backend podría usar
    const secrets = [SERVICE_SECRET, ADMIN_SECRET, CLIENT_SECRET].filter(
      Boolean
    );

    let payload = null;
    for (const s of secrets) {
      try {
        payload = jwt.verify(token, s);
        break;
      } catch (_e) {
        // seguimos probando con el siguiente secret
      }
    }

    if (!payload) {
      console.error("[socket.io] Token inválido para KDS");
      return next(new Error("Token inválido"));
    }

    // restaurantId puede venir con distintos nombres según el tipo de token
    const rid =
      Number(
        payload.restaurantId ??
          payload.restaurant_id ??
          payload.restauranteId ??
          0
      ) || Number(socket.handshake.auth?.restaurantId ?? 0);

    if (!rid) {
      console.error("[socket.io] Token sin restaurantId válido", payload);
      return next(new Error("Sin restaurantId"));
    }

    socket.restaurantId = rid;
    return next();
  });

  // 🔌 Adapter Redis opcional
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

  /* ========================
   * CONEXIONES KDS
   * ======================== */
  io.on("connection", (socket) => {
    const rid = socket.restaurantId;

    if (rid) {
      socket.join(roomId(rid));
      console.log(`👤 Cocina conectada a sala ${roomId(rid)}`);

      // ✅ Enviar lista inicial de pedidos recientes (12h, no anulados)
      (async () => {
        try {
          const { rows } = await pool.query(
            `SELECT 
               p.id,
               p.restaurant_id,
               p.order_no AS numero,
               p.estado,
               p.total AS monto,
               p.created_at,
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
             WHERE p.restaurant_id = $1
               AND p.estado <> 'anulado'
               AND p.created_at >= NOW() - INTERVAL '12 hours'
             ORDER BY p.created_at DESC`,
            [rid]
          );

          socket.emit("init_pedidos", rows);
        } catch (e) {
          console.error("init_pedidos error:", e.message);
        }
      })();
    } else {
      console.log("👤 Socket conectado sin restaurantId (broadcast)");
    }

    socket.on("kitchen.ack", (data) => {
      console.log("✅ ACK cocina:", data);
    });
  });

  console.log("✅ Socket.IO inicializado");
};

/* ========================
 * EMISORES GENERALES
 * ======================== */

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

/* ========================
 * Helpers para KDS
 * ======================== */

// Carga el pedido con sus items listo para el KDS
const buildPedidoKds = async (restaurantId, pedidoId) => {
  const { rows } = await pool.query(
    `SELECT 
       p.id,
       p.restaurant_id,
       p.order_no AS numero, 
       p.estado,
       p.total AS monto,
       p.created_at,
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

  if (!rows.length) return null;
  const pedido = rows[0];

  if (!pedido.restaurant_id) {
    pedido.restaurant_id = restaurantId;
  }

  return pedido;
};

// ✅ Emitir pedido recién creado (para KDS)
export const emitPedidoNuevoCompleto = async (restaurantId, pedidoId) => {
  if (!io) return;
  const pedido = await buildPedidoKds(restaurantId, pedidoId);
  if (!pedido) return;
  emitirPedidoCocina(pedido); // usa "nuevo_pedido"
};

// ✅ Emitir pedido pagado (para KDS)
export const emitPedidoPagadoCompleto = async (restaurantId, pedidoId) => {
  if (!io) return;
  const pedido = await buildPedidoKds(restaurantId, pedidoId);
  if (!pedido) return;
  emitPedidoPagado(restaurantId, pedido); // usa "pedido_pagado"
};
