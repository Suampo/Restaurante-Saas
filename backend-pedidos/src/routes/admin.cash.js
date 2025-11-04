// backend-pedidos/src/routes/admin.cash.js
import { Router } from "express";
import { pool } from "../config/db.js"; // <= ojo a la ruta real de tu pool

const router = Router();

/* ---------- util fechas ---------- */
const okDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());
const toUtcStart = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0,0,0));
const toUtcEnd   = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()+1, 0,0,0));

function parseDateFlexible(x) {
  if (!x) return null;
  if (typeof x === "number" || /^\d+$/.test(String(x))) {
    const d = new Date(Number(x)); return okDate(d) ? d : null;
  }
  const s = String(x).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { // YYYY-MM-DD
    const d = new Date(s + "T00:00:00Z"); return okDate(d) ? d : null;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { // DD/MM/YYYY
    const [dd,mm,yyyy] = s.split("/").map(Number);
    const d = new Date(Date.UTC(yyyy, mm-1, dd)); return okDate(d) ? d : null;
  }
  const d = new Date(s); return okDate(d) ? d : null;
}

function getRange(q) {
  const now = new Date();
  const defEnd = toUtcEnd(now);
  const defStart = new Date(defEnd); defStart.setUTCDate(defStart.getUTCDate() - 7);

  let s = parseDateFlexible(q.start);
  let e = parseDateFlexible(q.end);
  s = okDate(s) ? toUtcStart(s) : defStart;
  e = okDate(e) ? toUtcEnd(e)     : defEnd;
  return { start: s, end: e };
}

function getRestaurantId(req) {
  const fromHdr  = req.get("x-restaurant-id");
  const fromTok  = req.user?.restaurant_id ?? req.user?.restaurantId;
  const fromQry  = req.query.restaurantId;
  return Number(fromTok || fromHdr || fromQry || 0) || null;
}

/* ---------- endpoint ---------- */
// GET /admin/cash-movements?start=YYYY-MM-DD&end=YYYY-MM-DD&userId=<uuid>
router.get("/cash-movements", async (req, res) => {
  try {
    const restaurantId = getRestaurantId(req);
    if (!restaurantId) return res.status(400).json({ error: "Falta restaurant_id" });

    const { start, end } = getRange(req.query);
    const userId = req.query.userId || null;

    // Tarjetas
    const qCards = `
      SELECT
        COUNT(DISTINCT cm.created_by)                      AS workers_with_movs,
        COUNT(*) FILTER (WHERE cm.type='in')               AS movements,
        COALESCE(SUM(cm.amount) FILTER (WHERE cm.type='in'), 0)::float AS total_in
      FROM cash_movements cm
      WHERE cm.restaurant_id = $1
        AND cm.created_at >= $2 AND cm.created_at < $3
        AND cm.type IN ('in','out')
    `;
    const cards = await pool.query(qCards, [restaurantId, start.toISOString(), end.toISOString()]);
    const summary = {
      workers: Number(cards.rows[0]?.workers_with_movs || 0),
      movements: Number(cards.rows[0]?.movements || 0),
      total: Number(cards.rows[0]?.total_in || 0),
    };

    // Agregado por trabajador (nombre preferente: usuarios.nombre > auth.users.full_name > email)
    const qByWorker = `
      SELECT
        cm.created_by::text                                           AS user_id,
        au.email                                                      AS email,
        COALESCE(u.nombre, (au.raw_user_meta_data->>'full_name'))     AS name,
        COUNT(*)                                                      AS aprobaciones,
        COALESCE(SUM(cm.amount), 0)::float                            AS total_cobrado,
        MAX(cm.created_at)                                            AS last_dt
      FROM cash_movements cm
      LEFT JOIN auth.users au ON au.id = cm.created_by
      LEFT JOIN usuarios u ON u.email = au.email AND u.restaurant_id = $1
      WHERE cm.restaurant_id = $1
        AND cm.created_at >= $2 AND cm.created_at < $3
        AND cm.type = 'in'
      GROUP BY cm.created_by, au.email, name
      ORDER BY total_cobrado DESC NULLS LAST, aprobaciones DESC;
    `;
    const bw = await pool.query(qByWorker, [restaurantId, start.toISOString(), end.toISOString()]);
    const byWorker = bw.rows.map(r => ({
      userId: r.user_id,
      email: r.email || "(sin email)",
      name : r.name  || r.email || "(desconocido)",
      aprobaciones: Number(r.aprobaciones || 0),
      total: Number(r.total_cobrado || 0),
      last: r.last_dt ? new Date(r.last_dt).toISOString() : null,
    }));

    // Detalle opcional por trabajador
    let details = [];
    if (userId) {
      const qDet = `
        SELECT cm.id,
               cm.amount::float,
               cm.created_at,
               cm.note,
               p.pedido_id
        FROM cash_movements cm
        LEFT JOIN pagos p ON p.id = cm.pago_id
        WHERE cm.restaurant_id = $1
          AND cm.created_at >= $2 AND cm.created_at < $3
          AND cm.type='in'
          AND cm.created_by = $4::uuid
        ORDER BY cm.created_at DESC
        LIMIT 500;
      `;
      const d = await pool.query(qDet, [restaurantId, start.toISOString(), end.toISOString(), userId]);
      details = d.rows.map(x => ({
        id: x.id,
        amount: Number(x.amount || 0),
        createdAt: new Date(x.created_at).toISOString(),
        note: x.note || null,
        pedidoId: x.pedido_id || null,
      }));
    }

    return res.json({
      ok: true,
      range: { start: start.toISOString(), end: end.toISOString() },
      summary, byWorker, details
    });
  } catch (err) {
    console.error("[admin.cash] error:", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
