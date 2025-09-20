// src/routes/export.js
import { Router } from "express";
import { Pool } from "pg";
import { Parser } from "json2csv";

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

/* ---------- helpers ---------- */
function parseRange(q = {}) {
  const { from, to } = q;
  const start = from ? new Date(`${from}T00:00:00`) : new Date("1970-01-01T00:00:00");
  // to exclusivo: día siguiente 00:00
  const end = to
    ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000)
    : new Date("2100-01-01T00:00:00");
  return { start, end };
}

// Saca restaurantId (ajústalo a tu auth real)
function requireRestaurant(req, res, next) {
  const rid =
    Number(req.user?.restaurantId) ||
    Number(req.query.restaurantId) ||
    Number(req.headers["x-restaurant-id"]);
  if (!rid) return res.status(400).json({ error: "restaurantId requerido" });
  req.restaurantId = rid;
  next();
}

/* ---------- (opcional) verificar membresía ---------- */
// Descomenta si quieres forzar pertenencia al restaurante
// async function verifyMembership(req, res, next) {
//   try {
//     const userId = req.user?.id;
//     const rid = req.restaurantId;
//     if (!userId || !rid) return res.status(401).json({ error: "No autorizado" });
//     // Ajusta a tu tabla real de membresías
//     const { rowCount } = await pool.query(
//       "SELECT 1 FROM usuarios WHERE id = $1 AND restaurant_id = $2 LIMIT 1",
//       [userId, rid]
//     );
//     if (!rowCount) return res.status(403).json({ error: "Sin acceso al restaurante" });
//     next();
//   } catch (e) {
//     next(e);
//   }
// }

/* ---------- whitelist de recursos ---------- */
/* $1=restaurant_id, $2=start, $3=end */
const RESOURCES = {
  // === claves EXACTAS usadas en ExportDialog.jsx ===
  pedidos: {
    label: "Pedidos",
    sql: `
      SELECT p.id AS pedido_id, p.order_no, p.order_day, p.created_at, p.estado, p.total,
             m.codigo AS mesa,
             COALESCE((SELECT metodo FROM pagos pg WHERE pg.pedido_id=p.id ORDER BY pg.id DESC LIMIT 1),'') AS pago_metodo,
             COALESCE((SELECT estado FROM pagos pg WHERE pg.pedido_id=p.id ORDER BY pg.id DESC LIMIT 1),'') AS pago_estado
      FROM pedidos p
      LEFT JOIN mesas m ON m.id = p.mesa_id
      WHERE p.restaurant_id = $1
        AND p.created_at >= $2 AND p.created_at < $3
      ORDER BY p.created_at DESC;
    `,
  },
  pedido_detalle: { // antes: pedidos_items
    label: "Detalle de pedidos",
    sql: `
      SELECT p.id AS pedido_id, p.order_no, p.created_at,
             d.id AS detalle_id,
             CASE WHEN d.menu_item_id IS NOT NULL THEN 'item'
                  WHEN d.combo_id     IS NOT NULL THEN 'combo' END AS tipo,
             COALESCE(mi.nombre, c.nombre) AS nombre,
             d.cantidad, d.precio_unitario
      FROM pedido_detalle d
      JOIN pedidos p       ON p.id = d.pedido_id
      LEFT JOIN menu_items mi ON mi.id = d.menu_item_id
      LEFT JOIN combos c      ON c.id  = d.combo_id
      WHERE p.restaurant_id = $1
        AND p.created_at >= $2 AND p.created_at < $3
      ORDER BY p.created_at DESC, d.id;
    `,
  },
  combo_componentes: { // antes: pedidos_componentes
    label: "Componentes de combos (detalle)",
    sql: `
      SELECT p.id AS pedido_id, d.id AS detalle_id, dic.tipo, mi.nombre AS componente
      FROM pedido_detalle_combo_items dic
      JOIN pedido_detalle d ON d.id = dic.pedido_detalle_id
      JOIN pedidos p        ON p.id = d.pedido_id
      LEFT JOIN menu_items mi ON mi.id = dic.menu_item_id
      WHERE p.restaurant_id = $1
        AND p.created_at >= $2 AND p.created_at < $3
      ORDER BY p.created_at DESC, d.id;
    `,
  },
  pagos: {
    label: "Pagos",
    sql: `
      SELECT id, pedido_id, created_at, metodo, estado, monto, psp, currency, transaction_id
      FROM pagos
      WHERE restaurant_id = $1
        AND created_at >= $2 AND created_at < $3
      ORDER BY created_at DESC;
    `,
  },
  cpe: {
    label: "Comprobantes electrónicos (CPE)",
    sql: `
      SELECT id, pedido_id, restaurant_id, tipo_doc, serie, correlativo, fecha_emision,
             moneda, subtotal, igv, total, estado, sunat_ticket, sunat_notas,
             xml_url, pdf_url, cdr_url, created_at
      FROM cpe_documents
      WHERE restaurant_id = $1
        AND fecha_emision >= $2 AND fecha_emision < $3
      ORDER BY fecha_emision DESC, id DESC;
    `,
  },
  productos: { // antes: menu_items
    label: "Productos",
    sql: `
      SELECT id, created_at, deleted_at, activo, categoria_id, nombre, descripcion, precio
      FROM menu_items
      WHERE restaurant_id = $1
      ORDER BY id;
    `,
  },
  categorias: {
    label: "Categorías",
    sql: `
      SELECT id, created_at, nombre
      FROM categorias
      WHERE restaurant_id = $1
      ORDER BY id;
    `,
  },
  combos: {
    label: "Combos",
    sql: `
      SELECT id, created_at, updated_at, activo, nombre, precio, categoria_entrada_id, categoria_plato_id
      FROM combos
      WHERE restaurant_id = $1
      ORDER BY id;
    `,
  },
  insumos: {
    label: "Insumos",
    sql: `
      SELECT i.id, i.created_at, i.nombre, u.abrev AS unidad, i.stock_min, i.costo_unit, i.activo
      FROM insumos i
      JOIN unidades u ON u.id = i.unidad_id
      WHERE i.restaurant_id = $1
      ORDER BY i.id;
    `,
  },
  inv_movimientos: {
    label: "Movimientos de inventario",
    sql: `
      SELECT mv.id, mv.created_at, mv.tipo, mv.cantidad, mv.costo_unit,
             ins.nombre AS insumo, al.nombre AS almacen, mv.origen, mv.referencia, mv.pedido_id
      FROM inv_movimientos mv
      JOIN insumos ins ON ins.id = mv.insumo_id
      JOIN almacenes al ON al.id = mv.almacen_id
      WHERE mv.restaurant_id = $1
        AND mv.created_at >= $2 AND mv.created_at < $3
      ORDER BY mv.created_at DESC, mv.id DESC;
    `,
  },
  recetas: {
    label: "Recetas",
    sql: `
      SELECT r.menu_item_id, mi.nombre AS producto, r.insumo_id, ins.nombre AS insumo, r.cantidad
      FROM recetas r
      JOIN menu_items mi ON mi.id = r.menu_item_id
      JOIN insumos ins   ON ins.id = r.insumo_id
      WHERE r.restaurant_id = $1
      ORDER BY r.menu_item_id, r.insumo_id;
    `,
  },
  mesas: {
    label: "Mesas",
    sql: `
      SELECT id, codigo, descripcion
      FROM mesas
      WHERE restaurant_id = $1
      ORDER BY id;
    `,
  },
};

router.get("/export/:kind.csv", requireRestaurant /*, verifyMembership*/, async (req, res) => {
  const { kind } = req.params;
  const cfg = RESOURCES[kind];
  if (!cfg) return res.status(400).json({ error: "Recurso no soportado" });

  const { start, end } = parseRange(req.query);

  try {
    const { rows } = await pool.query(cfg.sql, [req.restaurantId, start, end]);
    const parser = new Parser({ header: true });
    const csv = parser.parse(rows);

    const fname = `${kind}_${req.restaurantId}_${req.query.from || "all"}_${req.query.to || "all"}.csv`.replace(/:/g, "-");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fname}"`);
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition"); // por si acaso
    res.setHeader("Cache-Control", "no-store");

    res.send(csv);
  } catch (e) {
    console.error("[export]", kind, e);
    res.status(500).json({ error: "No se pudo generar el CSV" });
  }
});

export default router;
