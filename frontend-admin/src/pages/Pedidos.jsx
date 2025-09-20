// src/pages/Pedidos.jsx
import { useEffect, useMemo, useState } from "react";
import API from "../services/axiosInstance";
import { getSocket } from "../lib/socket";
import {
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Download,
} from "lucide-react";

// PEN con 2 decimales
const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

// ===== helpers fecha =====
const atStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const atEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

// Convierte Date -> valor para <input type="date"> respetando zona local
const toDateInputValue = (d) => {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
};

// ✅ Convierte "YYYY-MM-DD" a Date **en hora local** (NO uses new Date(str))
const parseInputDateLocal = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

// ✅ Interpreta timestamps de DB como UTC si vienen SIN zona
// Ej: "2025-09-09 06:44:00" -> trata como "2025-09-09T06:44:00Z"
const parseDBDateUTC = (s) => {
  if (!s) return null;
  const norm = String(s).replace(" ", "T");
  const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(norm);
  return new Date(hasTZ ? norm : norm + "Z");
};

export default function Pedidos() {
  const [allPedidos, setAllPedidos] = useState([]);
  const [status, setStatus] = useState("Desconectado");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});

  // filtros / paginación
  const [day, setDay] = useState(toDateInputValue(new Date())); // solo 1 día
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  // ===== carga & realtime =====
  useEffect(() => {
    fetchPedidos(true);
    const socket = getSocket();
    socket.on("connect", () => setStatus("Conectado"));
    socket.on("disconnect", () => setStatus("Desconectado"));
    const refresh = () => fetchPedidos(false);
    socket.on("nuevo_pedido", refresh);
    socket.on("pedido_actualizado", refresh);
    socket.on("pedido_pagado", refresh);
    return () => {
      socket.off("nuevo_pedido", refresh);
      socket.off("pedido_actualizado", refresh);
      socket.off("pedido_pagado", refresh);
      socket.off("connect");
      socket.off("disconnect");
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setPage(1), [day, perPage]);
  useEffect(() => { fetchPedidos(true); }, [day]); // eslint-disable-line

  const fetchPedidos = async (withSpinner = true) => {
    try {
      setError("");
      if (withSpinner) setLoading(true);

      const params = { status: "pagado" };
      if (day) { params.from = day; params.to = day; params.date = day; }

      const res = await API.get("/pedidos", { params });
      setAllPedidos(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error";
      setError(msg);
      console.error("Error cargando pedidos:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

  // ===== filtrar SOLO por el día seleccionado (en local) =====
  const filtered = useMemo(() => {
    if (!day) return allPedidos;
    const base = parseInputDateLocal(day);
    const d0 = atStart(base);
    const d1 = atEnd(base);
    return allPedidos.filter((p) => {
      const d = parseDBDateUTC(p.created_at);
      if (!d) return false;
      return d >= d0 && d <= d1;
    });
  }, [allPedidos, day]);

  const totalFiltered = useMemo(
    () => filtered.reduce((acc, p) => acc + Number(p.monto || 0), 0),
    [filtered]
  );

  // ===== paginación =====
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const grupos = useMemo(() => groupByDay(pageItems), [pageItems]);

  const expandAll = () =>
    setExpanded(Object.fromEntries(pageItems.map((p) => [p.id, true])));
  const collapseAll = () => setExpanded({});
  const toggle = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(pageCount, p + 1));

  // exporta CSV de TODOS los pedidos del día filtrado
  const exportCsv = () => {
    const header = ["id", "numero", "mesa", "fecha", "hora", "monto", "items"];
    const rows = filtered.map((p) => {
      const d = parseDBDateUTC(p.created_at);
      const fecha = d ? d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" }) : "";
      const hora = d ? d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
      const items =
        p.items?.map?.((it) => `${Number(it.cantidad || 0) || 0}x ${(it.nombre || "").replaceAll('"', '""')}`).join(" | ") ||
        p.detalle?.map?.((dd) => dd?.nombre)?.join(" | ") ||
        p.resumen || "";
      return [p.id, p.numero ?? "", p.mesa ?? "", fecha, hora, Number(p.monto || 0).toFixed(2), `"${items.replaceAll('"', '""')}"`];
    });
    const csv = header.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos_${day || "hoy"}.csv`.replaceAll(":", "-");
    document.body.appendChild(a);
    a.click(); a.remove(); URL.revokeObjectURL(url);
  };

  const showingStart = filtered.length === 0 ? 0 : (page - 1) * perPage + 1;
  const showingEnd = Math.min(filtered.length, page * perPage);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pedidos</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <StatusBadge status={status} />
            <span>Pagados</span><span>•</span>
            <span>{filtered.length} pedidos</span><span>•</span>
            <span>Total {PEN.format(totalFiltered)}</span>
            {filtered.length > 0 && (<><span>•</span><span>Mostrando {showingStart}–{showingEnd}</span></>)}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            title="Día"
          />
          <button
            onClick={() => setDay(toDateInputValue(new Date()))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Hoy"
          >
            Hoy
          </button>

          <select
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            title="Elementos por página"
          >
            <option value={10}>10 / pág.</option>
            <option value={20}>20 / pág.</option>
            <option value={50}>50 / pág.</option>
          </select>

          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Exportar CSV (Excel)"
          >
            <Download size={18} className="text-slate-600" /> Exportar
          </button>

          <button
            onClick={() => fetchPedidos(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
            title="Actualizar"
          >
            <RefreshCw size={18} className={loading ? "animate-spin text-slate-500" : "text-slate-600"} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertCircle className="mt-0.5 h-4 w-4" />
          <div>
            <div className="font-medium">No se pudo cargar los pedidos</div>
            <div className="text-rose-700/90">{String(error)}</div>
          </div>
        </div>
      )}

      {/* Vacío */}
      {!loading && filtered.length === 0 && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">
          No hay pedidos para este día.
        </div>
      )}

      {/* Skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-16 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* Lista (página actual) */}
      {!loading && pageItems.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-600">Página {page} de {pageCount}</div>
            <div className="flex items-center gap-2">
              <button onClick={expandAll} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">Expandir todo</button>
              <button onClick={collapseAll} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50">Contraer todo</button>
            </div>
          </div>

          <div className="space-y-6">
            {grupos.map((g) => (
              <section key={g.label} className="space-y-3">
                <div className="sticky top-[56px] z-10 -mx-1 flex items-center justify-between rounded-md bg-slate-50 px-1 py-1">
                  <div className="text-sm font-medium text-slate-700">{g.label}</div>
                  <div className="text-xs text-slate-500">{g.list.length} pedidos • {PEN.format(g.total)}</div>
                </div>

                {g.list.map((p) => {
                  const d = parseDBDateUTC(p.created_at);
                  const hora = d ? d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";
                  return (
                    <article key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => toggle(p.id)}
                            className="mt-0.5 rounded-md border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
                            aria-label={expanded[p.id] ? "Contraer" : "Expandir"}
                            title={expanded[p.id] ? "Contraer" : "Expandir"}
                          >
                            {expanded[p.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </button>
                          <div>
                            <div className="text-base font-semibold">Pedido #{p.numero ?? p.id}</div>
                            <div className="text-sm text-slate-600">Mesa {p.mesa} • {hora}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={14} /> Pagado
                          </span>
                          <div className="mt-1 text-sm">
                            Monto: <span className="font-semibold">{PEN.format(Number(p.monto || 0))}</span>
                          </div>
                        </div>
                      </div>

                      {expanded[p.id] && p.items?.length > 0 && (
                        <ul className="mt-3 divide-y text-sm">
                          {p.items.map((it, i) => {
                            const precio = Number(it.importe ?? it.precio_unitario ?? 0) || 0;
                            return (
                              <li key={i} className="grid grid-cols-[auto,1fr,auto] items-start gap-3 py-2">
                                <span className="text-slate-500">{it.cantidad}×</span>
                                <div className="min-w-0">
                                  <div className="truncate">{it.nombre}</div>
                                  {it.tipo === "combo" && it.componentes?.length > 0 && (
                                    <div className="truncate text-xs text-slate-500">
                                      ({it.componentes.map((c) => c.nombre).join(", ")})
                                    </div>
                                  )}
                                </div>
                                <span className="font-medium">{PEN.format(precio)}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </article>
                  );
                })}
              </section>
            ))}
          </div>

          {/* Paginación */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <button onClick={goPrev} disabled={page <= 1} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50">Anterior</button>
            <div className="text-sm text-slate-600">Página {page} de {pageCount}</div>
            <button onClick={goNext} disabled={page >= pageCount} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50">Siguiente</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- helpers ---------- */
function labelFecha(iso) {
  if (!iso) return "";
  const d = parseDBDateUTC(iso);
  if (!d) return "";
  const hoy = atStart(new Date());
  const target = atStart(d);
  const ms = 24 * 60 * 60 * 1000;
  if (target.getTime() === hoy.getTime()) return "Hoy";
  if (target.getTime() === hoy.getTime() - ms) return "Ayer";
  return d.toLocaleDateString("es-PE", { weekday: "short", day: "2-digit", month: "short" });
}

function groupByDay(pedidos) {
  const getTs = (x) => parseDBDateUTC(x)?.getTime?.() ?? 0;
  const sorted = [...pedidos].sort((a, b) => getTs(b.created_at) - getTs(a.created_at));
  const map = new Map();
  for (const p of sorted) {
    const key = labelFecha(p.created_at) || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map, ([label, list]) => ({
    label,
    list,
    total: list.reduce((acc, it) => acc + Number(it.monto || 0), 0),
  }));
}

/* ---------- Subcomponentes ---------- */
function StatusBadge({ status }) {
  const ok = status === "Conectado";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs ${
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
      title={`Socket: ${status}`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-slate-400"}`} />
      {status}
    </span>
  );
}
