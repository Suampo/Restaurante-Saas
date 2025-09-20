// src/routes/reportesRoutes.js
import { Router } from "express";
import { pool } from "../config/db.js";       // ⬅ usa TU pool ya configurado
import { authTenant } from "../middlewares/authTenant.js";

const router = Router();

// Utiles de fechas (YYYY-MM-DD, corrigiendo TZ local)
const toYMD = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};
const normDate = (s) => (s || "").slice(0, 10);
const getRange = (req) => {
  const today = toYMD(new Date());
  let from = normDate(req.query.from) || today;
  let to   = normDate(req.query.to)   || today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
};

const ESTADO_OK = "pagado";

/* ───────────────── KPI RESUMEN ─────────────────
   GET /api/reportes/resumen?from&to
   → { total, pedidos, avg_ticket, items }
*/
router.get("/resumen", authTenant, async (req, res, next) => {
  try {
    const { restaurantId } = req.user;
    const { from, to } = getRange(req);

    const sql = `
      WITH base AS (
        SELECT p.id, p.total
        FROM pedidos p
        WHERE p.restaurant_id = $1
          AND p.estado = $4
          AND p.created_at::date BETWEEN $2 AND $3
      ),
      items AS (
        SELECT d.pedido_id, SUM(d.cantidad) AS items
        FROM pedido_detalle d
        JOIN pedidos p ON p.id = d.pedido_id
        WHERE p.restaurant_id = $1
          AND p.estado = $4
          AND p.created_at::date BETWEEN $2 AND $3
        GROUP BY d.pedido_id
      )
      SELECT
        COALESCE(SUM(b.total),0)::numeric AS total,
        COUNT(*)                           AS pedidos,
        COALESCE(AVG(b.total),0)::numeric AS avg_ticket,
        COALESCE(SUM(i.items),0)::numeric AS items
      FROM base b
      LEFT JOIN items i ON i.pedido_id = b.id
    `;
    const { rows } = await pool.query(sql, [restaurantId, from, to, ESTADO_OK]);
    res.json(rows[0] || { total: 0, pedidos: 0, avg_ticket: 0, items: 0 });
  } catch (e) { next(e); }
});

/* ──────────────── VENTAS DIARIAS ────────────────
   GET /api/reportes/ventas-diarias?from&to
   → [{ day, total, pedidos }]
*/
router.get("/ventas-diarias", authTenant, async (req, res, next) => {
  try {
    const { restaurantId } = req.user;
    const { from, to } = getRange(req);
    const sql = `
      SELECT p.created_at::date AS day,
             COALESCE(SUM(p.total),0)::numeric AS total,
             COUNT(*) AS pedidos
      FROM pedidos p
      WHERE p.restaurant_id = $1
        AND p.estado = $4
        AND p.created_at::date BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY 1
    `;
    const { rows } = await pool.query(sql, [restaurantId, from, to, ESTADO_OK]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ───────────────── VENTAS POR HORA ─────────────
   GET /api/reportes/por-hora?from&to
   → [{ hour: 0..23, total, pedidos }]
*/
router.get("/por-hora", authTenant, async (req, res, next) => {
  try {
    const { restaurantId } = req.user;
    const { from, to } = getRange(req);
    const sql = `
      SELECT EXTRACT(HOUR FROM p.created_at)::int AS hour,
             COALESCE(SUM(p.total),0)::numeric    AS total,
             COUNT(*)                              AS pedidos
      FROM pedidos p
      WHERE p.restaurant_id = $1
        AND p.estado = $4
        AND p.created_at::date BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY 1
    `;
    const { rows } = await pool.query(sql, [restaurantId, from, to, ESTADO_OK]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ───────────────── TOP ÍTEMS ────────────────────
   GET /api/reportes/top-items?from&to&limit=10
   → [{ id, nombre, cantidad, total }]
*/
router.get("/top-items", authTenant, async (req, res, next) => {
  try {
    const { restaurantId } = req.user;
    const { from, to } = getRange(req);
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 10));
    const sql = `
      SELECT COALESCE(mi.id, 0)                     AS id,
             COALESCE(mi.nombre, '—')              AS nombre,
             COALESCE(SUM(d.cantidad),0)::numeric  AS cantidad,
             COALESCE(SUM(d.cantidad*d.precio_unitario),0)::numeric AS total
      FROM pedido_detalle d
      JOIN pedidos p ON p.id = d.pedido_id
      LEFT JOIN menu_items mi ON mi.id = d.menu_item_id
      WHERE p.restaurant_id = $1
        AND p.estado = $4
        AND p.created_at::date BETWEEN $2 AND $3
      GROUP BY mi.id, mi.nombre
      ORDER BY cantidad DESC, total DESC
      LIMIT $5
    `;
    const { rows } = await pool.query(sql, [restaurantId, from, to, ESTADO_OK, limit]);
    res.json(rows);
  } catch (e) { next(e); }
});

/* ──────────────── MÉTODOS DE PAGO ───────────────
   GET /api/reportes/metodos-pago?from&to
   → [{ metodo, total, count }]
*/
router.get("/metodos-pago", authTenant, async (req, res, next) => {
  try {
    const { restaurantId } = req.user;
    const { from, to } = getRange(req);
    const sql = `
      SELECT COALESCE(pa.metodo,'Otros')         AS metodo,
             COALESCE(SUM(pa.monto),0)::numeric  AS total,
             COUNT(*)                            AS count
      FROM pagos pa
      JOIN pedidos p ON p.id = pa.pedido_id
      WHERE p.restaurant_id = $1
        AND p.estado = $4
        AND p.created_at::date BETWEEN $2 AND $3
      GROUP BY 1
      ORDER BY total DESC
    `;
    const { rows } = await pool.query(sql, [restaurantId, from, to, ESTADO_OK]);
    res.json(rows);
  } catch (e) { next(e); }
});

// Ping de salud opcional para verificar montaje
router.get("/health", (_req, res) => res.json({ ok: true }));

export default router;
