// src/pages/Pedidos.jsx
import { useEffect, useMemo, useState } from "react";
import API from "../services/axiosInstance";
import { getSocket } from "../lib/socket";
import {
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  CalendarDays,
  Download,
  ListOrdered,
  CircleDollarSign,
  Archive,
} from "lucide-react";

/* ---------- HELPERS ---------- */
const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});
const atStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const atEnd = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const toDateInputValue = (d) => {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 10);
};
const parseInputDateLocal = (str) => {
  if (!str) return null;
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const parseDBDateUTC = (s) => {
  if (!s) return null;
  const norm = String(s).replace(" ", "T");
  const hasTZ = /[zZ]|[+\-]\d{2}:?\d{2}$/.test(norm);
  return new Date(hasTZ ? norm : norm + "Z");
};
const toNextDayISO = (iso) => {
  const d = parseInputDateLocal(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + 1);
  return toDateInputValue(d);
};

// Devuelve la fecha “real” del cobro para un pedido
function getPaidDate(p) {
  // 1) buscar campos directos comunes
  const directKeys = [
    "paid_at",
    "paidAt",
    "approved_at",
    "approvedAt",
    "pagado_at",
    "cash_approved_at",
    "psp_approved_at",
    "updated_at",
    "updatedAt",
    "created_at", // fallback final
  ];
  let best = null;

  for (const k of directKeys) {
    if (p && p[k]) {
      const d = parseDBDateUTC(p[k]);
      if (d && (!best || d > best)) best = d;
    }
  }

  // 2) explorar pagos embebidos si vienen expandido(s)
  const pagosArr =
    (Array.isArray(p?.pagos) && p.pagos) ||
    (Array.isArray(p?.payments) && p.payments) ||
    null;

  if (pagosArr) {
    for (const pg of pagosArr) {
      const d = parseDBDateUTC(pg?.approved_at || pg?.approvedAt || pg?.created_at);
      if (d && (!best || d > best)) best = d;
    }
  }

  // 3) último fallback si nada
  return best || parseDBDateUTC(p?.created_at) || null;
}

function labelFechaByDate(d) {
  if (!d) return "";
  const hoy = atStart(new Date());
  const target = atStart(d);
  const ms = 24 * 60 * 60 * 1000;
  if (target.getTime() === hoy.getTime()) return "Hoy";
  if (target.getTime() === hoy.getTime() - ms) return "Ayer";
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "2-digit", month: "short" });
}

function groupByDayByEvent(pedidos) {
  const sorted = [...pedidos].sort(
    (a, b) => (b._eventAt?.getTime?.() ?? 0) - (a._eventAt?.getTime?.() ?? 0)
  );
  const map = new Map();
  for (const p of sorted) {
    const key = labelFechaByDate(p._eventAt) || "—";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return Array.from(map, ([label, list]) => ({
    label,
    list,
    total: list.reduce((acc, it) => acc + Number(it.monto || 0), 0),
  }));
}

/* ---------- SUB-UI ---------- */

function StatCard({ icon: Icon, label, value, loading }) {
  return (
    <div className="flex-1 rounded-lg bg-zinc-100/80 p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-zinc-500" />
        <span className="text-sm font-medium text-zinc-600">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-3/4 animate-pulse rounded-md bg-zinc-200" />
      ) : (
        <div className="mt-1 text-2xl font-bold text-zinc-900">{value}</div>
      )}
    </div>
  );
}

function PedidosHeader({ stats, filters, onFilterChange, onRefresh, onExport, loading }) {
  const { status, totalPedidos, totalMonto } = stats;
  const { day } = filters;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Historial de Pedidos</h1>
          <p className="text-zinc-500">Consulta los detalles de los pedidos pagados.</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            onClick={onExport}
            disabled={loading || totalPedidos === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50"
          >
            <Download size={16} /> <span className="hidden sm:inline">Exportar</span>
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Actualizar
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="sm:col-span-2 md:col-span-2">
          <label htmlFor="date-filter" className="mb-1 block text-sm font-medium text-zinc-700">
            Filtrar por fecha
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-grow">
              <CalendarDays
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                type="date"
                id="date-filter"
                value={day}
                onChange={(e) => onFilterChange("day", e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
            <button
              onClick={() => onFilterChange("day", toDateInputValue(new Date()))}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              Hoy
            </button>
          </div>
        </div>
        <StatCard icon={ListOrdered} label="Pedidos en el día" value={totalPedidos} loading={false} />
        <StatCard icon={CircleDollarSign} label="Monto Total" value={totalMonto} loading={false} />
      </div>
    </div>
  );
}

function PedidoCard({ pedido, isExpanded, onToggle }) {
  const d = pedido._eventAt || parseDBDateUTC(pedido.created_at);
  const hora = d ? d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <div className="rounded-2xl bg-white/80 shadow-lg shadow-zinc-200/50 backdrop-blur-lg transition-all">
      <div
        className="flex cursor-pointer items-center justify-between gap-3 p-4 hover:bg-zinc-50/50"
        onClick={() => onToggle(pedido.id)}
      >
        <div>
          <p className="font-semibold text-zinc-900">Pedido #{pedido.numero ?? pedido.id}</p>
          <p className="text-sm text-zinc-500">
            Mesa {pedido.mesa?.nombre || pedido.mesa} • {hora}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 size={14} /> Pagado
            </span>
            <p className="mt-1 font-semibold text-zinc-900">{PEN.format(Number(pedido.monto || 0))}</p>
          </div>
          <ChevronDown
            size={20}
            className={`text-zinc-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
          />
        </div>
      </div>
      {isExpanded && (
        <div className="border-t border-zinc-200 p-4">
          <h4 className="mb-2 font-semibold text-zinc-700">Detalle del pedido:</h4>
          <ul className="space-y-2 text-sm">
            {(pedido.items || pedido.detalle || []).map((it, i) => (
              <li key={i} className="flex items-start justify-between gap-2">
                <p className="text-zinc-600">
                  <span className="font-medium text-zinc-800">{it.cantidad}×</span> {it.nombre}
                </p>
                <p className="font-mono font-medium text-zinc-800">
                  {PEN.format(Number(it.importe ?? it.precio_unitario ?? 0))}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PaginationControls({ page, pageCount, onPrev, onNext, showingStart, showingEnd, totalFiltered }) {
  if (totalFiltered <= 0) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 p-3 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
      <button
        onClick={onPrev}
        disabled={page <= 1}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anterior
      </button>
      <div className="text-sm text-zinc-600">
        Mostrando {showingStart}–{showingEnd} de {totalFiltered}
      </div>
      <button
        onClick={onNext}
        disabled={page >= pageCount}
        className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Siguiente
      </button>
    </div>
  );
}

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

/* ---------- PAGE ---------- */

export default function Pedidos() {
  const [allPedidos, setAllPedidos] = useState([]);
  const [status, setStatus] = useState("Desconectado");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState({});
  const [day, setDay] = useState(toDateInputValue(new Date()));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const fetchPedidos = async (withSpinner = true) => {
    try {
      setError("");
      if (withSpinner) setLoading(true);

      // Rango por fecha de pago (si el backend lo soporta)
      const params = {
        status: "pagado",
        from: day,
        to: toNextDayISO(day),
        expand: "pagos", // si el backend lo ignora, no pasa nada
      };
      const res = await API.get("/pedidos", { params });
      const arr = Array.isArray(res.data) ? res.data : [];

      // Normalizar _eventAt (fecha de cobro/aprobación) para filtrar/mostrar
      const norm = arr.map((p) => ({ ...p, _eventAt: getPaidDate(p) }));
      setAllPedidos(norm);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Error";
      setError(msg);
      console.error("Error cargando pedidos:", err?.response?.data || err);
    } finally {
      setLoading(false);
    }
  };

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
  useEffect(() => {
    fetchPedidos(true);
  }, [day]); // eslint-disable-line

  // Filtrar por la fecha de evento (_eventAt)
  const filtered = useMemo(() => {
    if (!day) return allPedidos;
    const base = parseInputDateLocal(day);
    if (!base) return [];
    const d0 = atStart(base);
    const d1 = atEnd(base);
    return allPedidos.filter((p) => {
      const d = p._eventAt || parseDBDateUTC(p.created_at);
      return d && d >= d0 && d <= d1;
    });
  }, [allPedidos, day]);

  const totalFiltered = filtered.length;
  const totalMonto = useMemo(
    () => filtered.reduce((acc, p) => acc + Number(p.monto || 0), 0),
    [filtered]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page, perPage]);

  const grupos = useMemo(() => groupByDayByEvent(pageItems), [pageItems]);

  const toggle = (id) => setExpanded((s) => ({ ...s, [id]: !s[id] }));
  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(pageCount, p + 1));

  const exportCsv = () => {
    // placeholder de exportación
    console.log("Export CSV - implementar si se requiere");
  };

  const showingStart = totalFiltered === 0 ? 0 : (page - 1) * perPage + 1;
  const showingEnd = Math.min(totalFiltered, page * perPage);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="absolute inset-0 -z-10 bg-zinc-50" />

      <PedidosHeader
        stats={{ status, totalPedidos: totalFiltered, totalMonto: PEN.format(totalMonto) }}
        filters={{ day, perPage }}
        onFilterChange={(key, value) => (key === "day" ? setDay(value) : setPerPage(Number(value)))}
        onRefresh={() => fetchPedidos(true)}
        onExport={exportCsv}
        loading={loading}
      />

      {loading ? (
        <PedidosSkeleton />
      ) : error ? (
        <div className="py-10 text-center text-rose-600">{error}</div>
      ) : totalFiltered === 0 ? (
        <EmptyPedidos />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g.label}>
              <h2 className="mb-2 font-semibold text-zinc-800">{g.label}</h2>
              <div className="space-y-3">
                {g.list.map((p) => (
                  <PedidoCard key={p.id} pedido={p} isExpanded={!!expanded[p.id]} onToggle={toggle} />
                ))}
              </div>
            </div>
          ))}
          <PaginationControls
            page={page}
            pageCount={pageCount}
            onPrev={goPrev}
            onNext={goNext}
            showingStart={showingStart}
            showingEnd={showingEnd}
            totalFiltered={totalFiltered}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- STATES ---------- */

const PedidosSkeleton = () => (
  <div className="space-y-3">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="rounded-2xl bg-white/80 p-4 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
        <div className="flex animate-pulse items-center justify-between">
          <div>
            <div className="h-5 w-32 rounded bg-zinc-200" />
            <div className="mt-2 h-4 w-24 rounded bg-zinc-200" />
          </div>
          <div className="flex items-center gap-4">
            <div className="h-10 w-20 rounded-md bg-zinc-200" />
            <div className="h-6 w-6 rounded-full bg-zinc-200" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

const EmptyPedidos = () => (
  <div className="rounded-2xl bg-white/70 px-6 py-20 text-center shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
    <Archive size={48} className="mx-auto text-zinc-400" />
    <h3 className="mt-4 text-lg font-semibold text-zinc-800">No se encontraron pedidos</h3>
    <p className="mt-2 text-sm text-zinc-500">
      No hay pedidos pagados para la fecha seleccionada. Intenta con otro día.
    </p>
  </div>
);
