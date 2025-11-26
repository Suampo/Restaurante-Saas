// src/controllers/pedidoController.js
import { pool } from "../config/db.js";
import {
  emitPedidoPagadoCompleto,
  emitirPedidoCocina,
} from "../services/realtimeService.js";

/* =============== HELPERS =============== */

const getRestaurantIdLoose = (req) => {
  const fromUser = Number(req.user?.restaurantId || 0);
  const fromHeader = Number(req.get("x-restaurant-id") || 0);
  const fromBody = Number(req.body?.restaurantId || 0);
  return fromUser || fromHeader || fromBody || 0;
};

const parseLimit = (v, def = 50, max = 100) => {
  const n = Number(v);
  if (Number.isNaN(n) || n <= 0) return def;
  return Math.min(max, n);
};

const parseOffset = (v) => {
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return 0;
  return n;
};

/* =============== GET /api/pedidos =============== */
/**
 * Listado para admin / cocina.
 * Soporta:
 *  - ?estado=pagado  o ?status=pagado
 *  - ?from=ISO-8601  (UTC)
 *  - ?to=ISO-8601    (UTC)
 *  - ?limit=50&offset=0
 */
export const obtenerPedidos = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    if (!restaurantId) {
      return res
        .status(400)
        .json({ error: "restaurantId no detectado en el token" });
    }

    const statusRaw = (
      req.query.estado ||
      req.query.status ||
      "pagado"
    )
      .toString()
      .toLowerCase();

    const limit = parseLimit(req.query.limit, 50, 100);
    const offset = parseOffset(req.query.offset);

    const params = [restaurantId];
    let idx = 2;

    // Filtro por estado
    let condEstado = "";
    if (statusRaw !== "all") {
      condEstado = ` AND p.estado = $${idx++}`;
      params.push(statusRaw);
    }

    // Filtro por rango de fechas (created_at en UTC)
    let condFecha = "";
    if (req.query.from) {
      condFecha += ` AND p.created_at >= $${idx++}`;
      params.push(req.query.from);
    }
    if (req.query.to) {
      condFecha += ` AND p.created_at < $${idx++}`;
      params.push(req.query.to);
    }

    // Paginación
    const limitPos = idx++;
    const offsetPos = idx++;
    params.push(limit, offset);

    const sql = `
      SELECT 
        p.id,
        p.restaurant_id,
        p.mesa_id,
        p.order_no       AS numero,
        p.order_day,
        p.estado,
        p.total          AS monto,
        p.created_at,
        p.note           AS note,
        COALESCE(m.codigo, 'Mesa ' || p.mesa_id::text) AS mesa,

        -- Items
        COALESCE(
          (
            SELECT jsonb_agg(
                     jsonb_build_object(
                       'tipo', CASE WHEN d.menu_item_id IS NOT NULL THEN 'item' ELSE 'combo' END,
                       'nombre', COALESCE(mi.nombre, 'Combo #' || d.combo_id::text),
                       'cantidad', d.cantidad,
                       'precio_unitario', d.precio_unitario,
                       'importe', d.cantidad * d.precio_unitario
                     )
                   )
            FROM pedido_detalle d
            LEFT JOIN menu_items mi ON mi.id = d.menu_item_id
            WHERE d.pedido_id = p.id
          ),
          '[]'::jsonb
        ) AS items,

        -- Pagos
        COALESCE(
          (
            SELECT jsonb_agg(
                     jsonb_build_object(
                       'id',         pg.id,
                       'monto',      pg.monto,
                       'metodo',     pg.metodo,
                       'estado',     pg.estado,
                       'approved_at',pg.approved_at
                     )
                   )
            FROM pagos pg
            WHERE pg.pedido_id = p.id
          ),
          '[]'::jsonb
        ) AS pagos

      FROM pedidos p
      JOIN mesas m 
        ON m.id = p.mesa_id 
       AND m.restaurant_id = p.restaurant_id
      WHERE p.restaurant_id = $1
        ${condEstado}
        ${condFecha}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT $${limitPos}
      OFFSET $${offsetPos};
    `;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);
  } catch (error) {
    console.error("obtenerPedidos:", error);
    return res.status(500).json({ error: "Error obteniendo pedidos" });
  }
};

/* =============== POST /api/pedidos =============== */

export const crearPedido = async (req, res) => {
  const client = await pool.connect();
  let pedidoKds = null;

  try {
    const restaurantId = getRestaurantIdLoose(req);
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId requerido" });
    }

    const mesaId = Number(req.body?.mesaId || 0);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const idempotencyKey = String(req.body?.idempotencyKey || "");

    const comprobanteTipo = req.body?.comprobanteTipo || null;
    const billingClient = req.body?.billingClient ?? null;
    const billingEmail = (req.body?.billingEmail || "").trim() || null;

    const note =
      typeof req.body?.note === "string"
        ? req.body.note.trim().slice(0, 300)
        : null;

    if (!mesaId) return res.status(400).json({ error: "Falta mesaId" });
    if (!idempotencyKey)
      return res.status(400).json({ error: "Falta idempotencyKey" });
    if (!items.length) return res.status(400).json({ error: "Carrito vacío" });

    await client.query("BEGIN");

    // 1) Validar mesa (y quedarnos con el código para el KDS)
    const mesaQ = await client.query(
      `SELECT id, UPPER(codigo) AS codigo
         FROM public.mesas
        WHERE id=$1 AND restaurant_id=$2
        FOR SHARE`,
      [mesaId, restaurantId]
    );
    if (!mesaQ.rows.length) {
      throw new Error("Mesa no válida");
    }
    const mesaCodigo = mesaQ.rows[0].codigo || `MESA ${mesaId}`;

    // 2) Pre-calcular todos los IDs usados en el carrito
    const menuItemIdSet = new Set();
    const comboIdSet = new Set();

    for (const raw of items) {
      const comboId = Number(raw.combo_id || raw.comboId || 0);
      const menuItemId = Number(
        raw.menu_item_id || raw.menuItemId || raw.id || 0
      );
      if (comboId) comboIdSet.add(comboId);
      if (menuItemId) menuItemIdSet.add(menuItemId);

      const entradaId = Number(raw.entradaId || raw.entrada?.id || 0);
      const platoId = Number(raw.platoId || raw.plato?.id || 0);
      if (entradaId) menuItemIdSet.add(entradaId);
      if (platoId) menuItemIdSet.add(platoId);

      const gruposSel = Array.isArray(raw.grupos) ? raw.grupos : [];
      for (const g of gruposSel) {
        const itemsSel = Array.isArray(g.items) ? g.items : [];
        for (const chosen of itemsSel) {
          const mid = Number(chosen.id || chosen.menu_item_id || 0);
          if (mid) menuItemIdSet.add(mid);
        }
      }
    }

    // 3) Cargar precios de menu_items y combos en UNA sola pasada
    const menuItemsMap = new Map();
    if (menuItemIdSet.size) {
      const ids = Array.from(menuItemIdSet);
      const q = await client.query(
        `SELECT id, nombre, precio
           FROM public.menu_items
          WHERE restaurant_id=$1
            AND id = ANY($2::int[])
            AND activo = TRUE`,
        [restaurantId, ids]
      );
      for (const row of q.rows) {
        menuItemsMap.set(row.id, {
          nombre: row.nombre,
          precio: Number(row.precio || 0),
        });
      }
    }

    const combosMap = new Map();
    const comboGruposMap = new Map(); // { combo_id -> { entrada, plato } }
    if (comboIdSet.size) {
      const cids = Array.from(comboIdSet);
      const qc = await client.query(
        `SELECT id, nombre, precio
           FROM public.combos
          WHERE restaurant_id=$1
            AND id = ANY($2::int[])
            AND activo = TRUE`,
        [restaurantId, cids]
      );
      for (const row of qc.rows) {
        combosMap.set(row.id, {
          nombre: row.nombre,
          precio: Number(row.precio || 0),
        });
      }

      const qg = await client.query(
        `SELECT id, combo_id, nombre_grupo
           FROM public.combo_grupos
          WHERE combo_id = ANY($1::int[])`,
        [cids]
      );
      for (const row of qg.rows) {
        const entry = comboGruposMap.get(row.combo_id) || {};
        if (row.nombre_grupo === "Entrada") entry.entrada = row.id;
        if (row.nombre_grupo === "Plato") entry.plato = row.id;
        comboGruposMap.set(row.combo_id, entry);
      }
    }

    // 4) Insertar pedido idempotente
    const ped = await client.query(
      `INSERT INTO public.pedidos (
         restaurant_id, mesa_id, total, estado, created_at, idempotency_key,
         comprobante_tipo, billing_client, billing_email, note
       )
       VALUES ($1,$2,0,'pendiente_pago',NOW(),$3,$4,$5,$6,$7)
       ON CONFLICT (restaurant_id, idempotency_key)
       DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id, total, created_at, estado`,
      [
        restaurantId,
        mesaId,
        idempotencyKey,
        comprobanteTipo,
        billingClient,
        billingEmail,
        note,
      ]
    );
    const pedidoId = ped.rows[0].id;

    // 5) Si ya tenía detalle, devolvemos total existente (idempotente)
    //    👉 Un solo SELECT con COUNT + SUM
    const detStats = await client.query(
      `SELECT 
         COUNT(*)::int AS c,
         COALESCE(SUM(cantidad * precio_unitario),0) AS total
       FROM public.pedido_detalle
       WHERE pedido_id = $1`,
      [pedidoId]
    );

    if (detStats.rows[0].c > 0) {
      const totalExistente = Number(detStats.rows[0].total || 0);

      await client.query(
        `UPDATE public.pedidos
            SET total=$1,
                comprobante_tipo = COALESCE(comprobante_tipo, $2),
                billing_client   = COALESCE(billing_client,   $3),
                billing_email    = COALESCE(billing_email,    $4),
                note             = COALESCE(note, $6),
                updated_at=NOW()
          WHERE id=$5`,
        [totalExistente, comprobanteTipo, billingClient, billingEmail, pedidoId, note]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        mensaje: "Pedido ya existía (idempotente)",
        pedidoId,
        total: totalExistente,
        amount: Math.round(totalExistente * 100),
        currency: "PEN",
      });
    }

    // 6) Insertar detalle & armar snapshot para KDS
    let total = 0;
    const kdsItems = [];

    for (const it of items) {
      const cantidad = Math.max(1, Number(it.cantidad || it.qty || 1));
      const menuItemId = Number(
        it.menu_item_id || it.menuItemId || it.id || 0
      );
      const comboId = Number(it.combo_id || it.comboId || 0);

      // --- Combos ---
      if (comboId) {
        const comboInfo = combosMap.get(comboId);
        if (!comboInfo) throw new Error("Combo no válido");

        const precioUnit = comboInfo.precio;
        total += precioUnit * cantidad;

        const detIns = await client.query(
          `INSERT INTO public.pedido_detalle
             (pedido_id, menu_item_id, combo_id, cantidad, precio_unitario)
           VALUES ($1, NULL, $2, $3, $4)
           RETURNING id`,
          [pedidoId, comboId, cantidad, precioUnit]
        );
        const pedidoDetalleId = detIns.rows[0].id;

        // kds item
        kdsItems.push({
          tipo: "combo",
          nombre: comboInfo.nombre || `Combo #${comboId}`,
          cantidad,
          precio_unitario: precioUnit,
        });

        // Combos con grupos seleccionados explícitamente
        const gruposSel = Array.isArray(it.grupos) ? it.grupos : [];
        if (gruposSel.length) {
          for (const g of gruposSel) {
            const gid = Number(g.grupoId || g.id || 0);
            const itemsSel = Array.isArray(g.items) ? g.items : [];
            const tipoV2 = gid ? `g${gid}` : "grupo";
            for (const chosen of itemsSel) {
              const mid = Number(chosen.id || chosen.menu_item_id || 0);
              if (!mid || !gid) continue;
              await client.query(
                `INSERT INTO public.pedido_detalle_combo_items
                   (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
                 VALUES ($1, $2, $3, $4)`,
                [pedidoDetalleId, mid, gid, tipoV2]
              );
            }
          }
        } else {
          // Compat: combos "Entrada / Plato"
          const grupos = comboGruposMap.get(comboId) || {};
          const entradaId = Number(it.entradaId || it.entrada?.id || 0);
          const platoId = Number(it.platoId || it.plato?.id || 0);

          if (entradaId && grupos.entrada) {
            await client.query(
              `INSERT INTO public.pedido_detalle_combo_items
                 (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
               VALUES ($1, $2, $3, 'entrada')`,
              [pedidoDetalleId, entradaId, grupos.entrada]
            );
          }

          if (platoId && grupos.plato) {
            await client.query(
              `INSERT INTO public.pedido_detalle_combo_items
                 (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
               VALUES ($1, $2, $3, 'plato')`,
              [pedidoDetalleId, platoId, grupos.plato]
            );
          }
        }

        continue;
      }

      // --- Items sueltos ---
      if (menuItemId) {
        const miInfo = menuItemsMap.get(menuItemId);
        if (!miInfo) throw new Error("Item no válido");

        const precioUnit = miInfo.precio;
        total += precioUnit * cantidad;

        await client.query(
          `INSERT INTO public.pedido_detalle
             (pedido_id, menu_item_id, combo_id, cantidad, precio_unitario)
           VALUES ($1, $2, NULL, $3, $4)`,
          [pedidoId, menuItemId, cantidad, precioUnit]
        );

        kdsItems.push({
          tipo: "item",
          nombre: miInfo.nombre,
          cantidad,
          precio_unitario: precioUnit,
        });

        continue;
      }

      throw new Error("Item inválido");
    }

    // 7) Actualizar total + datos de facturación
    await client.query(
      `UPDATE public.pedidos
          SET total=$1,
              comprobante_tipo = COALESCE(comprobante_tipo, $2),
              billing_client   = COALESCE(billing_client,   $3),
              billing_email    = COALESCE(billing_email,    $4),
              note             = COALESCE(note, $6),
              updated_at=NOW()
        WHERE id=$5`,
      [total, comprobanteTipo, billingClient, billingEmail, pedidoId, note]
    );

    // 8) Construir snapshot para KDS SIN tocar otra vez la BD
    pedidoKds = {
      id: pedidoId,
      restaurant_id: restaurantId,
      numero: null, // el KDS puede usar id si no hay order_no
      estado: "pendiente_pago",
      monto: total,
      created_at: new Date().toISOString(),
      mesa: mesaCodigo,
      items: kdsItems,
    };

    await client.query("COMMIT");

    // 9) Emitir a KDS completamente fuera del flujo del request
    if (pedidoKds) {
      setImmediate(() => {
        try {
          emitirPedidoCocina(pedidoKds);
        } catch (e) {
          console.warn("[emitirPedidoCocina] warn:", e.message);
        }
      });
    }

    return res.status(201).json({
      mensaje: "Pedido creado",
      pedidoId,
      total,
      amount: Math.round(total * 100),
      currency: "PEN",
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rbErr) {
      console.error("❌ Error en ROLLBACK:", rbErr.message);
    }

    if (error?.code === "23505") {
      return res
        .status(409)
        .json({ error: "Conflicto de unicidad", detail: error.detail });
    }

    console.error("❌ crearPedido:", error);
    return res.status(500).json({ error: "Error creando pedido" });
  } finally {
    client.release();
  }
};

/* =============== PATCH /api/pedidos/:id =============== */

export const actualizarPedidoEstado = async (req, res) => {
  let client;
  try {
    client = await pool.connect();

    const pedidoId = Number(req.params?.id);
    const { estado } = req.body;

    if (!pedidoId)
      return res
        .status(400)
        .json({ error: "Falta el ID del pedido en la URL" });

    const allowed = ["pendiente_pago", "pagado", "anulado"];
    if (!estado || !allowed.includes(estado)) {
      return res.status(400).json({ error: "Estado inválido" });
    }

    await client.query("BEGIN");

    const q0 = await client.query(
      `SELECT id, restaurant_id, estado FROM pedidos WHERE id = $1 FOR UPDATE`,
      [pedidoId]
    );
    if (!q0.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    const pedido = q0.rows[0];

    if (estado === "anulado" && pedido.estado !== "pendiente_pago") {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json({ error: "El pedido ya no está pendiente de pago" });
    }

    const q1 = await client.query(
      `UPDATE pedidos
         SET estado = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, estado, total AS monto, restaurant_id`,
      [estado, pedidoId]
    );

    await client.query("COMMIT");

    const updated = q1.rows[0];

    if (estado === "pagado") {
      (async () => {
        try {
          await emitPedidoPagadoCompleto(updated.restaurant_id, pedidoId);
        } catch (e) {
          console.warn("[emitPedidoPagadoCompleto] warn:", e.message);
        }
      })();
    }

    return res.json(updated);
  } catch (e) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rErr) {
        console.error("ROLLBACK error:", rErr.message);
      }
    }
    console.error("actualizarPedidoEstado:", {
      message: e.message,
      code: e.code,
      stack: e.stack,
    });
    return res
      .status(500)
      .json({ error: "No se pudo actualizar el estado del pedido" });
  } finally {
    if (client) client.release();
  }
};

/* =============== GET /api/pedidos/admin/recent =============== */

export const obtenerPedidosRecientes = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    const limit = Number(req.query.limit ?? 10);

    const sql = `
      WITH d AS (
        SELECT generate_series(
          current_date - ($2::int - 1) * interval '1 day',
          current_date,
          interval '1 day'
        )::date AS dia
      )
      SELECT
        CASE EXTRACT(DOW FROM d.dia)
          WHEN 1 THEN 'L' WHEN 2 THEN 'M' WHEN 3 THEN 'X'
          WHEN 4 THEN 'J' WHEN 5 THEN 'V' WHEN 6 THEN 'S'
          ELSE 'D'
        END AS label,
        COALESCE(SUM(p.total), 0)::numeric AS total
      FROM d
      LEFT JOIN pedidos p
        ON p.restaurant_id = $1
       AND p.estado = 'pagado'
       AND p.created_at::date = d.dia
      GROUP BY d.dia
      ORDER BY d.dia;
    `;

    const { rows } = await pool.query(sql, [restaurantId, limit]);
    return res.json({
      labels: rows.map((r) => r.label),
      data: rows.map((r) => Number(r.total)),
    });
  } catch (e) {
    console.error("obtenerPedidosRecientes:", e);
    return res
      .status(500)
      .json({ error: "No se pudo obtener pedidos recientes" });
  }
};

/* =============== GET /api/pedidos/admin/stats/sales-by-day =============== */

export const ventasPorDia = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    const days = Math.max(1, Math.min(30, Number(req.query.days ?? 7)));

    const sql = `
      WITH d AS (
        SELECT generate_series(
          current_date - ($2::int - 1) * interval '1 day',
          current_date,
          interval '1 day'
        )::date AS dia
      )
      SELECT
        CASE EXTRACT(DOW FROM d.dia)
          WHEN 1 THEN 'L' WHEN 2 THEN 'M' WHEN 3 THEN 'X'
          WHEN 4 THEN 'J' WHEN 5 THEN 'V' WHEN 6 THEN 'S'
          ELSE 'D'
        END AS label,
        COALESCE(SUM(p.total), 0)::numeric AS total
      FROM d
      LEFT JOIN pedidos p
        ON p.restaurant_id = $1
       AND p.estado = 'pagado'
       AND p.created_at::date = d.dia
      GROUP BY d.dia
      ORDER BY d.dia;
    `;

    const { rows } = await pool.query(sql, [restaurantId, days]);
    return res.json({
      labels: rows.map((r) => r.label),
      data: rows.map((r) => Number(r.total)),
    });
  } catch (e) {
    console.error("ventasPorDia:", e);
    return res
      .status(500)
      .json({ error: "No se pudo calcular ventas por día" });
  }
};
