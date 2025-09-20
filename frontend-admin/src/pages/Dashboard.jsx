// src/pages/Dashboard.jsx
import { useEffect, useState, useRef } from "react";
import {
  AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  getKpis, getSalesByDay, getRecentOrders, getMesas, searchMenuItems,
} from "../services/dashboardApi";
import { useNavigate } from "react-router-dom";

// PEN con 2 decimales
const PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });

// Paleta: Terracotta (green) + Slate
const PALETTE = {
  primary: "#2e4f29",
  primaryFill: "green",
  grid: "#e5e7eb",
  tick: "#64748b",
  text: "#0f172a",
};

// util: media query simple para saber si es viewport pequeño
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(query);
    const h = (e) => setMatches(e.matches);
    m.addEventListener?.("change", h);
    setMatches(m.matches);
    return () => m.removeEventListener?.("change", h);
  }, [query]);
  return matches;
}

export default function Dashboard() {
  const [kpis, setKpis] = useState({ ventasDia: 0, tickets: 0, avg: 0, margen: 0 });
  const [ventas, setVentas] = useState([]);        // [{dia, total}]
  const [recent, setRecent] = useState([]);        // pedidos recientes
  const [mesas, setMesas] = useState([]);          // listado de mesas (muestra pocas)
  const [range, setRange] = useState(7);           // 7 / 30 / 90 días
  const [loading, setLoading] = useState({ kpis: true, ventas: true, recent: true, mesas: true });

  const initRan = useRef(false);                   // 👈 evita doble carga en DEV (StrictMode)
  const nav = useNavigate();
  const isMobile = useMediaQuery("(max-width: 640px)");

  // carga inicial
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;

    (async () => {
      try {
        setLoading((s) => ({ ...s, kpis: true, recent: true, mesas: true }));
        const [k, r, m] = await Promise.all([getKpis(), getRecentOrders(6), getMesas()]);
        setKpis({
          ventasDia: Number(k?.ventasDia || 0),
          tickets: Number(k?.tickets || 0),
          avg: Number(k?.avg || 0),
          margen: Number(k?.margen || 0),
        });
        setRecent(Array.isArray(r) ? r : []);
        setMesas(Array.isArray(m) ? m.slice(0, 3) : []);
      } catch (e) {
        console.error("Dashboard init:", e);
      } finally {
        setLoading((s) => ({ ...s, kpis: false, recent: false, mesas: false }));
      }
    })();
  }, []);

  // ventas por rango
  useEffect(() => {
    (async () => {
      try {
        setLoading((s) => ({ ...s, ventas: true }));
        const serie = await getSalesByDay(range);
        const data = Array.isArray(serie?.data) && Array.isArray(serie?.labels)
          ? serie.labels.map((l, i) => ({ dia: l, total: Number(serie.data[i] || 0) }))
          : [];
        setVentas(data);
      } catch (e) {
        console.error("Dashboard ventas:", e);
      } finally {
        setLoading((s) => ({ ...s, ventas: false }));
      }
    })();
  }, [range]);

  const miniSeries = ventas.map((d) => ({ y: d.total }));

  return (
    <div className="space-y-6">
      {/* fondo suave */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-slate-50 via-white to-slate-100" />

      {/* header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Inicio</h1>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="range">Rango</label>
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm sm:w-auto"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button
            onClick={() => nav("/mesas")}
            className="w-full rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 sm:w-auto"
          >
            Nueva mesa
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard title="Ventas del día" value={PEN.format(kpis.ventasDia)} loading={loading.kpis} series={miniSeries} />
        <StatCard title="Pedidos del día" value={kpis.tickets} loading={loading.kpis} />
        <StatCard title="Ticket promedio" value={PEN.format(kpis.avg)} loading={loading.kpis} />
        <StatCard title="Margen" value={PEN.format(kpis.margen)} loading={loading.kpis} />
      </div>

      {/* gráfico + productos */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={`Ventas (${range} días)`}>
          <div className="h-56 sm:h-64 md:h-72 xl:h-80">
            {loading.ventas ? (
              <Skeleton className="h-full rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PALETTE.primaryFill} stopOpacity={0.30} />
                      <stop offset="100%" stopColor={PALETTE.primaryFill} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={PALETTE.grid} strokeDasharray="4 4" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={{ stroke: PALETTE.grid }} tick={{ fill: PALETTE.tick, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={{ stroke: PALETTE.grid }} tick={{ fill: PALETTE.tick, fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, borderColor: PALETTE.grid }}
                    labelStyle={{ color: PALETTE.text, fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="total" stroke={PALETTE.primary} strokeWidth={2} fill="url(#gradPrimary)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <QuickProductCard />
      </div>

      {/* pedidos recientes + mesas */}
      <div className="grid gap-6 lg:grid-cols-3">
        <RecentOrdersCard
          compact={isMobile}
          items={recent}
          loading={loading.recent}
          onVerTodo={() => nav("/pedidos")}
          className="lg:col-span-2"
        />
        <MesasQuickCard
          mesas={mesas}
          loading={loading.mesas}
          onIrMesas={() => nav("/mesas")}
          onNuevaMesa={() => nav("/mesas")}
        />
      </div>
    </div>
  );
}

/* ---------- componentes base ---------- */
function Card({ title, action, className = "", children }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse bg-slate-200/70 ${className}`} />;
}

function StatCard({ title, value, delta, loading, series = [] }) {
  const up = typeof delta === "number" && delta >= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="text-sm text-slate-500">{title}</div>
        {/* sparkline */}
        {Array.isArray(series) && series.length > 1 && (
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="miniGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PALETTE.primaryFill} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={PALETTE.primaryFill} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="y" stroke={PALETTE.primary} strokeWidth={2} fill="url(#miniGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-7 w-32 rounded" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <div className="text-3xl font-semibold tracking-tight">{value}</div>
          {typeof delta === "number" && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-green-700"}`}>
              {up ? "▲" : "▼"} {Math.abs(delta)}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Pedidos recientes ---------- */
function RecentOrdersCard({ items = [], loading, onVerTodo, compact = false, className = "" }) {
  return (
    <Card
      className={className}
      title="Pedidos recientes"
      action={<button onClick={onVerTodo} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">Ver todos</button>}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full rounded" />
          <Skeleton className="h-9 w-full rounded" />
          <Skeleton className="h-9 w-full rounded" />
        </div>
      ) : compact ? (
        // Layout compacto para móviles
        <ul className="space-y-3">
          {items.length === 0 ? (
            <li className="text-sm text-slate-500">No hay pedidos recientes.</li>
          ) : items.map((p) => (
            <li key={p.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">Pedido #{p.numero ?? p.id}</div>
                  <div className="text-xs text-slate-500">
                    Mesa: {p.mesa?.nombre || p.mesa?.codigo || `MESA-${p.mesa_id ?? "?"}`}
                  </div>
                </div>
                <EstadoBadge estado={p.estado} />
              </div>
              {p.detalle?.length || p.resumen ? (
                <div className="mt-2 line-clamp-2 text-sm text-slate-700">
                  {p.detalle?.map?.((d) => d?.nombre).join(", ") || p.resumen}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        // Tabla para pantallas grandes (con scroll horizontal)
        <div className="overflow-auto">
          <table className="min-w-[640px] w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-slate-500">
                <th className="py-2">ID</th>
                <th>Mesa</th>
                <th>Detalle</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr><td className="py-6 text-center text-slate-500" colSpan={4}>No hay pedidos recientes.</td></tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="odd:bg-slate-50/40">
                    <td className="py-2">#{p.id}</td>
                    <td>{p.mesa?.nombre || p.mesa?.codigo || `MESA-${p.mesa_id ?? "?"}`}</td>
                    <td className="truncate max-w-[360px]">
                      {p.detalle?.map?.(d => d?.nombre).join(", ") || p.resumen || "—"}
                    </td>
                    <td><EstadoBadge estado={p.estado} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function EstadoBadge({ estado = "" }) {
  const e = String(estado).toLowerCase();
  const styles = e.includes("sirv") || e.includes("listo")
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : e.includes("prep") || e.includes("pend")
    ? "bg-amber-50 text-amber-700 border-amber-200"
    : "bg-slate-50 text-slate-700 border-slate-200";
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${styles}`}>{estado || "—"}</span>;
}

/* ---------- Mesas rápidas ---------- */
function MesasQuickCard({ mesas = [], loading, onIrMesas, onNuevaMesa }) {
  return (
    <Card
      title="Generador de mesas"
      action={<button onClick={onIrMesas} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">Ir a mesas</button>}
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
          <Skeleton className="h-10 rounded" />
        </div>
      ) : (
        <div className="space-y-2">
          {mesas.length === 0 && <div className="text-sm text-slate-500">Aún no hay mesas.</div>}
          {mesas.map((m) => (
            <div key={m.id} className="flex flex-col items-start justify-between gap-2 rounded-lg border border-slate-200 p-2 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="font-medium">{m.nombre || m.codigo || `Mesa ${m.id}`}</span>
                <span className="text-xs text-slate-500">cap. {m.capacidad ?? "-"}</span>
              </div>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <button className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 sm:flex-initial" onClick={onIrMesas}>Editar</button>
                <button className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 sm:flex-initial" onClick={onIrMesas}>Limpiar</button>
                <button className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50 sm:flex-initial" onClick={onIrMesas}>Cerrar</button>
              </div>
            </div>
          ))}
          <button
            onClick={onNuevaMesa}
            className="mt-2 w-full rounded-lg border-2 border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            + Nueva mesa
          </button>
        </div>
      )}
    </Card>
  );
}

/* ---------- Quick productos ---------- */
function QuickProductCard() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  // función de búsqueda (filtra activos)
  const runSearch = async (term) => {
    try {
      setLoading(true);
      const res = await searchMenuItems((term || "").trim(), { onlyActive: 1 }); // 👈 sin _ts
      const clean = (res || []).filter(it => (it.activo ?? it.visible ?? true) && !it.eliminado);
      setItems(clean.slice(0, 3));
    } catch (e) {
      console.error("searchMenuItems:", e);
    } finally {
      setLoading(false);
    }
  };

  // buscar cuando el usuario escribe
  useEffect(() => {
    const t = setTimeout(() => runSearch(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  // re-buscar cuando vuelves a la pestaña o cuando el Menú notifica cambios
  useEffect(() => {
    const onFocus = () => runSearch(q);
    const onChanged = () => runSearch(q);
    window.addEventListener("focus", onFocus);
    window.addEventListener("menu:changed", onChanged);
    runSearch(q); // primera carga
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("menu:changed", onChanged);
    };
  }, []); // sólo una vez

  const goToMenu = () => nav("/menu");

  return (
    <Card
      title="Productos"
      action={<button onClick={goToMenu} className="rounded-md border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50">Abrir en “Menú”</button>}
      className=""
    >
      <label className="sr-only" htmlFor="qprod">Buscar producto</label>
      <input
        id="qprod"
        className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        placeholder="Busca un plato..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded" />
          <Skeleton className="h-14 rounded" />
          <Skeleton className="h-14 rounded" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No hay resultados. Prueba otra búsqueda o crea un plato.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-3">
                <img
                  src={
                    it.imagen_url ||
                    "data:image/svg+xml;utf8," +
                      encodeURIComponent(
                        `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='60'><rect width='100%' height='100%' fill='#e5e7eb'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='12' fill='#6b7280'>Sin imagen</text></svg>`
                      )
                  }
                  alt=""
                  className="h-12 w-16 rounded object-cover ring-1 ring-black/5"
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{it.nombre}</div>
                  <div className="text-xs text-slate-500">{PEN.format(Number(it.precio || 0))}</div>
                </div>
              </div>
              <button
                onClick={goToMenu}
                className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                title="Editar en Menú"
              >
                Editar
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
