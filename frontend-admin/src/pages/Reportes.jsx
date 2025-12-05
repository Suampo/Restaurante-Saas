// src/pages/Reportes.jsx
import { useEffect, useMemo, useState } from "react";
import ExportDialog from "../components/ExportDialog";
import API from "../services/axiosInstance";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  BarChart2,
  DollarSign,
  ShoppingCart,
  Percent,
  FileDown,
} from "lucide-react";

/* ---------- UTILS ---------- */
const TZ = "America/Lima";
const LIMA_OFFSET_HOURS = -5; // UTC -> Lima (sin DST)

const fmtSoles = (n) =>
  `S/ ${Number(n ?? 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtNum = (n) => Number(n ?? 0).toLocaleString("es-PE");

// 👉 Helper para formatear siempre YYYY-MM-DD usando la hora local
function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// HOY en hora local (no UTC)
function todayISO() {
  return formatYMD(new Date());
}

// Suma/resta días a un ISO (tratándolo como fecha local)
function addDaysISO(iso, delta) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return formatYMD(d);
}

// Inicio de mes de una fecha ISO (en local)
function monthStartISO(iso) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(1);
  return formatYMD(d);
}

// Etiqueta de día SIEMPRE en Lima
const fmtDayLima = (s) => {
  const d = new Date(s);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
  }).format(d);
};

// Si el backend agrega por hora en UTC, mapea a hora local Lima
const toLimaHour = (utcHour) =>
  ((Number(utcHour) + 24 + LIMA_OFFSET_HOURS) % 24);

// Presets de rango (inclusive en UI)
const PRESETS = [
  {
    k: "today",
    label: "Hoy",
    get: () => {
      const t = todayISO();
      return { from: t, to: t };
    },
  },
  {
    k: "7",
    label: "Últimos 7 días",
    get: () => {
      const t = todayISO();
      return { from: addDaysISO(t, -6), to: t };
    },
  },
  {
    k: "30",
    label: "Últimos 30 días",
    get: () => {
      const t = todayISO();
      return { from: addDaysISO(t, -29), to: t };
    },
  },
  {
    k: "mtd",
    label: "Este mes",
    get: () => {
      const t = todayISO();
      return { from: monthStartISO(t), to: t };
    },
  },
];
const PRESET_DEFAULT_KEY = "7";

/* ---------- PAGE ---------- */
export default function Reportes() {
  const def = PRESETS.find((p) => p.k === PRESET_DEFAULT_KEY).get();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [activePreset, setActivePreset] = useState(PRESET_DEFAULT_KEY);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");
  const [resumen, setResumen] = useState({});
  const [diarias, setDiarias] = useState([]);
  const [porHora, setPorHora] = useState([]);
  const [topItems, setTopItems] = useState([]);
  const [pagos, setPagos] = useState([]);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setBusy(true);
        setErr("");

        // 'to' exclusivo → enviamos to + 1 día al backend
        const qs = {
          params: { from, to: addDaysISO(to, 1) },
          signal: ctrl.signal,
        };
        const [r1, r2, r3, r4, r5] = await Promise.all([
          API.get("/reportes/resumen", qs),
          API.get("/reportes/ventas-diarias", qs),
          API.get("/reportes/por-hora", qs),
          API.get("/reportes/top-items", {
            ...qs,
            params: { ...qs.params, limit: 10 },
          }),
          API.get("/reportes/metodos-pago", qs),
        ]);

        if (!alive) return;
        setResumen(r1.data || {});
        setDiarias(Array.isArray(r2.data) ? r2.data : []);
        setPorHora(Array.isArray(r3.data) ? r3.data : []);
        setTopItems(Array.isArray(r4.data) ? r4.data : []);
        setPagos(Array.isArray(r5.data) ? r5.data : []);
      } catch (e) {
        if (!alive || e.name === "CanceledError") return;
        setErr(
          e?.response?.data?.error ||
            e?.message ||
            "No se pudo cargar reportes"
        );
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [from, to]);

  const pagosTotal = useMemo(
    () => pagos.reduce((a, b) => a + Number(b.total || 0), 0),
    [pagos]
  );

  const applyPreset = (k) => {
    const p = PRESETS.find((x) => x.k === k);
    if (!p) return;
    const r = p.get();
    setFrom(r.from);
    setTo(r.to);
    setActivePreset(k);
  };

  // Si cambias manualmente el rango, desactiva el preset activo
  useEffect(() => {
    const currentPreset = PRESETS.find((p) => p.k === activePreset);
    if (currentPreset) {
      const range = currentPreset.get();
      if (range.from !== from || range.to !== to) {
        setActivePreset(null);
      }
    }
  }, [from, to, activePreset]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="absolute inset-0 -z-10 bg-zinc-50" />

      <Header
        from={from}
        to={to}
        setFrom={setFrom}
        setTo={setTo}
        presets={PRESETS}
        activePreset={activePreset}
        onPresetClick={applyPreset}
        onExportClick={() => setShowExport(true)}
      />

      {err && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          {err}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          title="Ventas Totales"
          value={fmtSoles(resumen.total)}
          loading={busy}
        />
        <StatCard
          icon={ShoppingCart}
          title="Total Pedidos"
          value={fmtNum(resumen.pedidos)}
          loading={busy}
        />
        <StatCard
          icon={Percent}
          title="Ticket Promedio"
          value={fmtSoles(resumen.avg_ticket)}
          loading={busy}
        />
        <StatCard
          icon={BarChart2}
          title="Items Vendidos"
          value={fmtNum(resumen.items)}
          loading={busy}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ReportCard title="Ventas Diarias" className="lg:col-span-3" loading={busy}>
          <DailySalesChart data={diarias} />
        </ReportCard>
        <ReportCard title="Ventas por Hora" className="lg:col-span-2" loading={busy}>
          <HourlySalesChart data={porHora} />
        </ReportCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ReportCard title="Métodos de Pago" className="lg:col-span-2" loading={busy}>
          <ul className="space-y-3">
            {pagos.map((p) => {
              const pct =
                pagosTotal > 0
                  ? (100 * Number(p.total || 0)) / pagosTotal
                  : 0;
              return (
                <li key={p.metodo}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-zinc-800">
                      {p.metodo || "—"}
                    </span>
                    <span className="tabular-nums font-semibold text-zinc-800">
                      {fmtSoles(p.total)}
                    </span>
                  </div>
                  <div className="h-2 rounded bg-zinc-200">
                    <div
                      className="h-2 rounded bg-green-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
            {pagos.length === 0 && !busy && (
              <EmptyState>Sin datos de pago</EmptyState>
            )}
          </ul>
        </ReportCard>

        <ReportCard
          title="Top 10 Productos Más Vendidos"
          className="lg:col-span-3"
          loading={busy}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="font-medium text-zinc-500">
                <tr className="text-left">
                  <th className="p-2">Producto</th>
                  <th className="p-2 text-right">Cantidad</th>
                  <th className="p-2 text-right">Ventas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {topItems.map((r) => (
                  <tr key={r.id}>
                    <td className="p-2 font-medium text-zinc-800">
                      {r.nombre}
                    </td>
                    <td className="p-2 text-right font-mono">
                      {fmtNum(r.cantidad)}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {fmtSoles(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {topItems.length === 0 && !busy && (
              <EmptyState>Sin datos de productos</EmptyState>
            )}
          </div>
        </ReportCard>
      </div>

      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        from={from}
        to={to}
      />
    </div>
  );
}

/* ---------- UI BITS ---------- */

function Header({
  from,
  to,
  setFrom,
  setTo,
  presets,
  activePreset,
  onPresetClick,
  onExportClick,
}) {
  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Reportes y Analítica
          </h1>
          <p className="text-zinc-500">
            Analiza el rendimiento de tu negocio en rangos de fechas.
          </p>
        </div>
        <button
          onClick={onExportClick}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          <FileDown size={16} /> Exportar Reporte Completo
        </button>
      </div>

      <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-white/70 p-3 shadow-lg shadow-zinc-200/50 backdrop-blur-lg md:flex-row">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
          {presets.map((p) => (
            <button
              key={p.k}
              onClick={() => onPresetClick(p.k)}
              className={`rounded-md px-3 py-1 text-sm font-semibold transition-colors ${
                activePreset === p.k
                  ? "bg-white text-green-700 shadow-sm"
                  : "text-zinc-600 hover:bg-white/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex-grow" />
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700">Desde:</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-zinc-700">Hasta:</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
          />
        </div>
      </div>
    </div>
  );
}

function ReportCard({ title, children, className = "", loading }) {
  return (
    <div
      className={`rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg ${className}`}
    >
      {title && (
        <h3 className="mb-4 text-lg font-semibold text-zinc-800">{title}</h3>
      )}
      {loading ? (
        <div className="h-48 animate-pulse rounded-md bg-zinc-200/80" />
      ) : (
        children
      )}
    </div>
  );
}

function EmptyState({ children }) {
  return (
    <div className="py-10 text-center text-sm text-zinc-500">{children}</div>
  );
}

function StatCard({ icon: Icon, title, value, loading }) {
  return (
    <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-600">
        <Icon size={16} /> {title}
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-3/4 animate-pulse rounded-md bg-zinc-200/80" />
      ) : (
        <div className="mt-1 tabular-nums text-3xl font-bold text-zinc-900">
          {value}
        </div>
      )}
    </div>
  );
}

/* ---------- CHARTS ---------- */
const chartMargin = { top: 5, right: 10, left: -25, bottom: 0 };

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg bg-white/80 p-2 shadow-lg backdrop-blur-sm ring-1 ring-zinc-200">
        <p className="font-semibold">{label}</p>
        <p className="text-green-600">{`Ventas: ${fmtSoles(
          payload[0].value
        )}`}</p>
      </div>
    );
  }
  return null;
};

function DailySalesChart({ data }) {
  const chartData = data.map((d) => ({
    name: fmtDayLima(d.day), // "dd/mm"
    total: Number(d.total || 0),
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={chartMargin}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e4e4e7"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `S/${v / 1000}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#10b981"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#colorTotal)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function HourlySalesChart({ data }) {
  // Mapea hora UTC -> hora Lima y compone las 24 horas
  const mapped = (Array.isArray(data) ? data : []).map((d) => ({
    hourLocal: toLimaHour(d.hour),
    total: Number(d.total || 0),
  }));
  const chartData = Array.from({ length: 24 }, (_, h) => {
    const f = mapped.find((x) => x.hourLocal === h);
    return { name: `${h}h`, total: Number(f?.total || 0) };
  });

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} margin={chartMargin}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e4e4e7"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            interval={3}
          />
          <YAxis
            stroke="#71717a"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `S/${v / 1000}k`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(228, 228, 231, 0.5)" }}
          />
          <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
