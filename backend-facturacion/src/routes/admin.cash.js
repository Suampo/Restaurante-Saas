// backend-facturacion/src/routes/admin.cash.js
const express = require("express");
const router = express.Router();
const { supabase } = require("../services/supabase");

// Utilidades de rango inclusivo por fecha (local->ISO)
function toStartISO(d) {
  return d ? new Date(`${d}T00:00:00Z`).toISOString() : null;
}
function toEndISO(d) {
  return d ? new Date(`${d}T23:59:59Z`).toISOString() : null;
}

const UUID_RX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

router.get("/cash-movements", async (req, res) => {
  try {
    const { start, end, estado = "all", userId } = req.query;

    const startISO = toStartISO(start);
    const endISO = toEndISO(end);

    // ---------- 1) Lista base (para "Mov. efectivo") ----------
    let q = supabase
      .from("pagos")
      .select(
        "id,pedido_id,restaurant_id,monto,metodo,estado,psp," +
          "approved_at,approved_by,approved_by_user_id," +
          "cash_received,cash_change,cash_note,created_at," +
          "pedido:pedidos(order_no)",
        { count: "exact" }
      )
      .eq("metodo", "efectivo")
      .eq("psp", "cash");

    if (startISO) q = q.gte("created_at", startISO);
    if (endISO) q = q.lte("created_at", endISO);
    if (estado !== "all") q = q.eq("estado", estado);

    // Filtro por mozo: admite uuid o email
    if (userId) {
      if (UUID_RX.test(userId)) q = q.eq("approved_by_user_id", userId);
      else q = q.eq("approved_by", userId);
    }

    const { data: rowsRaw, error } = await q.order("created_at", {
      ascending: false,
    });
    if (error) throw error;

    // Añadimos pedido_numero a cada fila (order_no por pedido)
    const rows = (rowsRaw || []).map((r) => ({
      ...r,
      pedido_numero: r.pedido?.order_no ?? r.pedido_numero ?? null,
    }));

    // ---------- 2) Stats de cabecera ----------
    const approvedRows = rows.filter(
      (r) => String(r.estado || "").toLowerCase() === "approved"
    );
    const totalEfectivo = approvedRows.reduce(
      (s, r) => s + Number(r.monto || 0),
      0
    );

    // ---------- 3) Mapear emails -> nombres desde public.usuarios ----------
    const uniqueEmails = Array.from(
      new Set(
        approvedRows
          .map((r) => String(r.approved_by || "").toLowerCase())
          .filter(Boolean)
      )
    );

    let nameByEmail = {};
    if (uniqueEmails.length > 0) {
      const { data: urows, error: eUsers } = await supabase
        .from("usuarios")
        .select("email,nombre")
        .in("email", uniqueEmails);
      if (!eUsers) {
        (urows || []).forEach((u) => {
          if (u?.email) {
            nameByEmail[String(u.email).toLowerCase()] = u.nombre || null;
          }
        });
      }
    }

    // ---------- 4) Agregado por trabajador (para pantalla Trabajadores) ----------
    const byMap = new Map();
    for (const r of approvedRows) {
      const key = r.approved_by_user_id || r.approved_by || "(desconocido)"; // id único (uuid o email)
      const email = r.approved_by || null;
      const cur = byMap.get(key) || {
        userId: key,
        email,
        name: null, // lo llenamos con usuarios.nombre
        aprobaciones: 0,
        total: 0,
        last: null,
      };
      cur.aprobaciones += 1;
      cur.total += Number(r.monto || 0);
      const lastTs = r.approved_at || r.created_at;
      if (!cur.last || (lastTs && lastTs > cur.last)) cur.last = lastTs;
      byMap.set(key, cur);
    }

    const byWorker = Array.from(byMap.values())
      .map((w) => {
        const resolved = w.email
          ? nameByEmail[String(w.email).toLowerCase()]
          : null;
        return {
          ...w,
          name: resolved || w.name || w.email || "(desconocido)",
        };
      })
      .sort((a, b) => (b.total || 0) - (a.total || 0));

    const summary = {
      workers: byWorker.length,
      movements: approvedRows.length,
      total: totalEfectivo,
    };

    // ---------- 5) (Opcional) Detalle por trabajador si llega userId ----------
    let details;
    if (userId) {
      const filterIsUuid = UUID_RX.test(userId);
      details = rows
        .filter((r) =>
          filterIsUuid
            ? r.approved_by_user_id === userId
            : r.approved_by === userId
        )
        .map((r) => ({
          id: r.id,
          pedido_id: r.pedido_id,
          pedido_numero: r.pedido_numero ?? null,
          amount: Number(r.monto || 0),
          cash_received: r.cash_received,
          cash_change: r.cash_change,
          note: r.cash_note || null,
          estado: r.estado,
          approved_at: r.approved_at,
          created_at: r.created_at,
        }))
        .sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }

    return res.json({
      rows,
      stats: { totalEfectivo },
      summary,
      byWorker,
      ...(details ? { details } : {}),
      range: { start: startISO, end: endISO },
    });
  } catch (e) {
    console.error("[admin.cash] error /cash-movements", e);
    return res.status(400).json({ error: e.message || "Error" });
  }
});

module.exports = router;
