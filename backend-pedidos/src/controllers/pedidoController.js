// src/controllers/pedidoController.js
import { pool } from "../config/db.js";
import { emitPedidoPagadoCompleto } from "../services/realtimeService.js";

const getRestaurantIdLoose = (req) => {
  const fromUser   = Number(req.user?.restaurantId || 0);
  const fromHeader = Number(req.get("x-restaurant-id") || 0);
  const fromBody   = Number(req.body?.restaurantId || 0);
  return fromUser || fromHeader || fromBody || 0;
};

/** ========================
 *  GET /api/pedidos (admin)
 *  ======================== */
export const obtenerPedidos = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    const status = (req.query.status || "pagado").toLowerCase();

    const params = [restaurantId];
    const condEstado = status !== "all" ? ` AND p.estado = $${params.push(status)}` : "";

    const sql = `
      WITH items AS (
        SELECT 
          p.id AS pedido_id,
          jsonb_build_object(
            'tipo', 'item',
            'nombre', mi.nombre,
            'cantidad', pd.cantidad,
            'precio_unitario', pd.precio_unitario,
            'importe', (pd.cantidad * pd.precio_unitario)
          ) AS item
        FROM pedidos p
        JOIN pedido_detalle pd ON pd.pedido_id = p.id
        JOIN menu_items mi     ON mi.id = pd.menu_item_id
        WHERE p.restaurant_id = $1 ${condEstado}
          AND pd.menu_item_id IS NOT NULL

        UNION ALL

        SELECT
          p.id AS pedido_id,
          jsonb_build_object(
            'tipo', 'combo',
            'nombre', COALESCE(c.nombre, 'Combo #' || pd.combo_id::text),
            'cantidad', pd.cantidad,
            'precio_unitario', pd.precio_unitario,
            'importe', (pd.cantidad * pd.precio_unitario)
          ) AS item
        FROM pedidos p
        JOIN pedido_detalle pd ON pd.pedido_id = p.id
        LEFT JOIN combos c     ON c.id = pd.combo_id
        WHERE p.restaurant_id = $1 ${condEstado}
          AND pd.combo_id IS NOT NULL
      )
      SELECT
        p.id,
        p.order_no AS numero,
        p.order_day,
        p.estado,
        p.total AS monto,
        p.created_at,
        p.note AS note,
        COALESCE(m.codigo, 'Mesa ' || p.mesa_id::text) AS mesa,
        COALESCE(
          (SELECT jsonb_agg(i.item) FROM items i WHERE i.pedido_id = p.id),
          '[]'::jsonb
        ) AS items
      FROM pedidos p
      JOIN mesas m ON m.id = p.mesa_id AND m.restaurant_id = p.restaurant_id
      WHERE p.restaurant_id = $1 ${condEstado}
      ORDER BY p.created_at DESC;
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("obtenerPedidos:", error);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
};

/** ========================
 *  POST /api/pedidos  (público con CSRF) / (admin con token)
 *  ======================== */
export const crearPedido = async (req, res) => {
  const client = await pool.connect();
  try {
    const restaurantId = getRestaurantIdLoose(req);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });

    const mesaId         = Number(req.body?.mesaId || 0);
    const items          = Array.isArray(req.body?.items) ? req.body.items : [];
    const idempotencyKey = String(req.body?.idempotencyKey || "");

    // Facturación opcional
    const comprobanteTipo = req.body?.comprobanteTipo || null; // "01" | "03" | null
    const billingClient   = req.body?.billingClient ?? null;   // json
    const billingEmail    = (req.body?.billingEmail || "").trim() || null;

    // Nota para cocina (opcional)
    const note = typeof req.body?.note === "string"
      ? req.body.note.trim().slice(0, 300)
      : null;

    if (!mesaId) return res.status(400).json({ error: "Falta mesaId" });
    if (!idempotencyKey) return res.status(400).json({ error: "Falta idempotencyKey" });
    if (!items.length) return res.status(400).json({ error: "Carrito vacío" });

    await client.query("BEGIN");

    // 1) Mesa válida
    const mesaQ = await client.query(
      `SELECT id, UPPER(codigo) AS codigo
         FROM public.mesas
        WHERE id=$1 AND restaurant_id=$2
        FOR SHARE`,
      [mesaId, restaurantId]
    );
    if (!mesaQ.rows.length) throw new Error("Mesa no válida");

    // 1.1) SOLO si NO es LLEVAR: anula otros pedidos pendientes de esta mesa
    const esLlevar = (mesaQ.rows[0].codigo || "") === "LLEVAR";
    if (!esLlevar) {
      await client.query(
        `UPDATE public.pedidos p
            SET estado = 'anulado', updated_at = NOW()
          WHERE p.restaurant_id = $1
            AND p.mesa_id = $2
            AND p.estado = 'pendiente_pago'`,
        [restaurantId, mesaId]
      );
    }

    // 2) Inserta pedido idempotente (con facturación y nota)
    const ped = await client.query(
      `INSERT INTO public.pedidos (
         restaurant_id, mesa_id, total, estado, created_at, idempotency_key,
         comprobante_tipo, billing_client, billing_email, note
       )
       VALUES ($1,$2,0,'pendiente_pago',NOW(),$3,$4,$5,$6,$7)
       ON CONFLICT (restaurant_id, idempotency_key)
       DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING id, comprobante_tipo, billing_client, billing_email, note`,
      [restaurantId, mesaId, idempotencyKey, comprobanteTipo, billingClient, billingEmail, note]
    );
    const pedidoId = ped.rows[0].id;

    // 3) Si ya hay detalle (reintento idempotente)
    const detCount = await client.query(
      `SELECT COUNT(*)::int AS c FROM public.pedido_detalle WHERE pedido_id = $1`,
      [pedidoId]
    );
    if (detCount.rows[0].c > 0) {
      const totalQ = await client.query(
        `SELECT COALESCE(SUM(cantidad * precio_unitario),0) AS total
           FROM public.pedido_detalle
          WHERE pedido_id = $1`,
        [pedidoId]
      );
      const totalExistente = Number(totalQ.rows[0].total || 0);

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

    // 4) Inserta detalle (combos / items)
    let total = 0;
    for (const it of items) {
      const cantidad   = Math.max(1, Number(it.cantidad || it.qty || 1));
      const menuItemId = Number(it.menu_item_id || it.menuItemId || it.id || 0);
      const comboId    = Number(it.combo_id || it.comboId || 0);

      if (comboId) {
        const comboQ = await client.query(
          `SELECT precio FROM public.combos WHERE id=$1 AND restaurant_id=$2 AND activo=TRUE`,
          [comboId, restaurantId]
        );
        if (!comboQ.rows.length) throw new Error("Combo no válido");
        const precioUnit = Number(comboQ.rows[0].precio || 0);
        total += precioUnit * cantidad;

        const detIns = await client.query(
          `INSERT INTO public.pedido_detalle (pedido_id, menu_item_id, combo_id, cantidad, precio_unitario)
           VALUES ($1, NULL, $2, $3, $4)
           RETURNING id`,
          [pedidoId, comboId, cantidad, precioUnit]
        );
        const pedidoDetalleId = detIns.rows[0].id;

        const gruposSel = Array.isArray(it.grupos) ? it.grupos : [];
        if (gruposSel.length) {
          for (const g of gruposSel) {
            const gid = Number(g.grupoId || g.id || 0);
            const itemsSel = Array.isArray(g.items) ? g.items : [];
            for (const chosen of itemsSel) {
              const mid = Number(chosen.id || chosen.menu_item_id || 0);
              if (!mid || !gid) continue;
              const tipoV2 = `g${gid}`;
              await client.query(
                `INSERT INTO public.pedido_detalle_combo_items
                   (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
                 VALUES ($1, $2, $3, $4)`,
                [pedidoDetalleId, mid, gid, tipoV2]
              );
            }
          }
        } else {
          const entradaId = Number(it.entradaId || it.entrada?.id || 0);
          const platoId   = Number(it.platoId   || it.plato?.id   || 0);

          if (entradaId) {
            const qg = await client.query(
              `SELECT id FROM public.combo_grupos WHERE combo_id=$1 AND nombre_grupo='Entrada' LIMIT 1`,
              [comboId]
            );
            const gid = qg.rows[0]?.id || null;
            if (gid) {
              await client.query(
                `INSERT INTO public.pedido_detalle_combo_items
                   (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
                 VALUES ($1, $2, $3, 'entrada')`,
                [pedidoDetalleId, entradaId, gid]
              );
            }
          }

          if (platoId) {
            const qg = await client.query(
              `SELECT id FROM public.combo_grupos WHERE combo_id=$1 AND nombre_grupo='Plato' LIMIT 1`,
              [comboId]
            );
            const gid = qg.rows[0]?.id || null;
            if (gid) {
              await client.query(
                `INSERT INTO public.pedido_detalle_combo_items
                   (pedido_detalle_id, menu_item_id, combo_grupo_id, tipo)
                 VALUES ($1, $2, $3, 'plato')`,
                [pedidoDetalleId, platoId, gid]
              );
            }
          }
        }
        continue;
      }

      if (menuItemId) {
        const pr = await client.query(
          `SELECT precio FROM public.menu_items WHERE id=$1 AND restaurant_id=$2 AND activo=TRUE`,
          [menuItemId, restaurantId]
        );
        if (!pr.rows.length) throw new Error("Item no válido");

        const precioUnit = Number(pr.rows[0].precio || 0);
        total += precioUnit * cantidad;

        await client.query(
          `INSERT INTO public.pedido_detalle (pedido_id, menu_item_id, combo_id, cantidad, precio_unitario)
           VALUES ($1, $2, NULL, $3, $4)`,
          [pedidoId, menuItemId, cantidad, precioUnit]
        );
        continue;
      }

      throw new Error("Item inválido");
    }

    // 5) Actualiza total + billing + nota
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

    await client.query("COMMIT");
    res.status(201).json({
      mensaje: "Pedido creado",
      pedidoId,
      total,
      amount: Math.round(total * 100),
      currency: "PEN",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (error?.code === "23505") {
      if (error?.constraint === "uniq_open_order_per_table") {
        const q = await pool.query(
          `SELECT id FROM public.pedidos
            WHERE restaurant_id=$1 AND mesa_id=$2 AND estado='pendiente_pago'
            ORDER BY created_at DESC LIMIT 1`,
          [getRestaurantIdLoose(req), req.body.mesaId]
        );
        const existing = q.rows[0]?.id;
        return res
          .status(409)
          .json({ error: "La mesa ya tiene un pedido abierto", pedidoId: existing });
      }
      return res.status(409).json({ error: "Conflicto de unicidad", detail: error.detail });
    }

    console.error("❌ crearPedido:", error);
    res.status(500).json({ error: "Error creando pedido" });
  } finally {
    client.release();
  }
};
/** ========================
 *  PATCH /api/pedidos/:id  (admin)
 *  ======================== */
export const actualizarPedidoEstado = async (req, res) => {
  const client = await pool.connect();
  try {
    const pedidoId = Number(req.params?.id);
    const { estado } = req.body;

    if (!pedidoId) return res.status(400).json({ error: "Falta el ID del pedido en la URL" });

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
      return res.status(409).json({ error: "El pedido ya no está pendiente de pago" });
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
      try {
        await emitPedidoPagadoCompleto(updated.restaurant_id, pedidoId);
      } catch (e) {
        console.warn("[emitPedidoPagadoCompleto] warn:", e.message);
      }
    }

    res.json(updated);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("actualizarPedidoEstado:", e);
    res.status(500).json({ error: "No se pudo actualizar el estado del pedido" });
  } finally {
    client.release();
  }
};

/** ========================
 *  GET /api/pedidos/admin/recent?limit=10
 *  ======================== */
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
    return res.status(500).json({ error: "No se pudo obtener pedidos recientes" });
  }
};

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
    return res.status(500).json({ error: "No se pudo calcular ventas por día" });
  }
};
