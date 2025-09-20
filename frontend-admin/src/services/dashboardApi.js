// src/services/dashboardApi.js
import API from "./axiosInstance";

const inflight = new Map();
const dedupe = (key, fn) => {
  if (inflight.has(key)) return inflight.get(key);
  const p = Promise.resolve().then(fn).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
};

// util: YYYY-MM-DD en local (sin problemas de zona horaria)
const ymd = (d) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().slice(0, 10);
};

// KPIs del día usando /reportes/ventas-diarias
export async function getKpis() {
  const today = ymd(new Date());
  const key = `kpis:${today}`;

  return dedupe(key, async () => {
    try {
      const { data: rows } = await API.get("/reportes/ventas-diarias", {
        params: { from: today, to: today },
      });
      const r = Array.isArray(rows) && rows[0] ? rows[0] : { total: 0, pedidos: 0 };
      const total = Number(r.total || 0);
      const pedidos = Number(r.pedidos || 0);
      const avg = pedidos > 0 ? total / pedidos : 0;
      return { ventasDia: total, tickets: pedidos, avg, margen: 0 };
    } catch {
      return { ventasDia: 0, tickets: 0, avg: 0, margen: 0 };
    }
  });
}

/** Serie de ventas por día (mapea a /reportes/ventas-diarias?from&to) */
export async function getSalesByDay(days = 7) {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - Math.max(0, days - 1));
  const fromStr = ymd(from), toStr = ymd(to);
  const key = `ventas:${fromStr}:${toStr}`;

  return dedupe(key, async () => {
    try {
      const { data: rows } = await API.get("/reportes/ventas-diarias", {
        params: { from: fromStr, to: toStr },
      });
      // rows: [{ day, total, pedidos }]
      const map = new Map((rows || []).map(r => [String(r.day).slice(0,10), Number(r.total || 0)]));

      const labels = [];
      const serie  = [];
      for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        const k = ymd(d);
        labels.push(k);
        serie.push(map.get(k) ?? 0);
      }
      return { labels, data: serie };
    } catch {
      return { labels: [], data: [] };
    }
  });
}

/** Pedidos recientes – intenta varias rutas y cae con gracia */
export async function getRecentOrders(limit = 6) {
  const key = `recent:${limit}`;
  return dedupe(key, async () => {
    try {
      const { data } = await API.get("/pedidos/admin/recent", { params: { limit } });
      return Array.isArray(data) ? data.slice(0, limit) : [];
    } catch {
      try {
        const { data } = await API.get("/pedidos/admin", { params: { limit, order: "desc" } });
        return Array.isArray(data) ? data.slice(0, limit) : [];
      } catch {
        try {
          const { data } = await API.get("/pedidos", { params: { limit, order: "desc" } });
          const arr = Array.isArray(data) ? data : (data?.data || []);
          return arr.slice(0, limit);
        } catch {
          return [];
        }
      }
    }
  });
}

/** Mesas (para el widget rápido) */
export async function getMesas() {
  return dedupe("mesas", async () => {
    try {
      const { data } = await API.get("/mesas");
      return Array.isArray(data) ? data : (data?.data || []);
    } catch {
      return [];
    }
  });
}

/** Búsqueda rápida de productos (sin /menu-items/search) */
export async function searchMenuItems(q = "", opts = {}) {
  const params = { ...(q ? { search: q } : {}), ...opts }; // tu backend acepta "search" o "q"; si usa "q", cambia aquí

  try {
    const { data } = await API.get("/menu-items", { params });
    let list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);

    // filtro cliente si pides sólo activos
    if (opts.onlyActive) {
      list = list.filter(it => (it.activo ?? it.visible ?? true) && !it.eliminado);
    }

    // si el backend no filtra por ?search, filtramos aquí
    const term = String(q || "").trim().toLowerCase();
    if (term) {
      list = list.filter(
        it =>
          (it.nombre || "").toLowerCase().includes(term) ||
          (it.descripcion || it.desc || "").toLowerCase().includes(term)
      );
    }
    return list;
  } catch {
    return [];
  }
}
