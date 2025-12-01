// src/pages/Dashboard.jsx
import { useEffect, useState, useRef, Suspense, lazy } from "react";
import {
  getKpis,
  getSalesByDay,
  getRecentOrders,
  getMesas,
  searchMenuItems,
} from "../services/dashboardApi";
import { useNavigate } from "react-router-dom";
import {
  DollarSign,
  ShoppingCart,
  Percent,
  BarChart2,
  Search,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { proxyImg } from "../utils/imageProxy";

// 👇 gráfico lazy
const DashboardChart = lazy(() => import("../components/DashboardChart"));

// FORMATEADOR DE MONEDA (PEN con 2 decimales)
const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

// Hook de media query
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
  const [kpis, setKpis] = useState({
    ventasDia: 0,
    tickets: 0,
    avg: 0,
    margen: 0,
  });
  const [ventas, setVentas] = useState([]);
  const [recent, setRecent] = useState([]);
  const [mesas, setMesas] = useState([]);
  const [range, setRange] = useState(7);
  const [loading, setLoading] = useState({
    kpis: true,
    ventas: true,
    recent: true,
    mesas: true,
  });

  const initRan = useRef(false);
  const nav = useNavigate();
  const isMobile = useMediaQuery("(max-width: 768px)");

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
        setLoading((s) => ({
          ...s,
          kpis: false,
          recent: false,
          mesas: false,
        }));
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading((s) => ({ ...s, ventas: true }));
        const serie = await getSalesByDay(range);
        const data =
          Array.isArray(serie?.data) && Array.isArray(serie?.labels)
            ? serie.labels.map((l, i) => ({
                dia: l,
                total: Number(serie.data[i] || 0),
              }))
            : [];
        setVentas(data);
      } catch (e) {
        console.error("Dashboard ventas:", e);
      } finally {
        setLoading((s) => ({ ...s, ventas: false }));
      }
    })();
  }, [range]);

  return (
    <div className="space-y-8 p-4 md:p-6 lg:p-8">
      {/* FONDO */}
      <div className="absolute inset-0 -z-10 bg-zinc-50" />

      {/* HEADER */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Bienvenido de vuelta
          </h1>
          <p className="text-zinc-500">
            Aquí tienes un resumen de la actividad de tu negocio.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <select
            id="range"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 md:w-auto"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
          <button
            onClick={() => nav("/mesas")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 active:bg-green-800 md:w-auto"
          >
            <Plus size={16} />
            Nueva Mesa
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={DollarSign}
          title="Ventas del día"
          value={PEN.format(kpis.ventasDia)}
          delta="+5.2%"
          loading={loading.kpis}
        />
        <StatCard
          icon={ShoppingCart}
          title="Pedidos del día"
          value={kpis.tickets}
          delta="+12"
          loading={loading.kpis}
        />
        <StatCard
          icon={BarChart2}
          title="Ticket promedio"
          value={PEN.format(kpis.avg)}
          delta="-1.8%"
          loading={loading.kpis}
        />
        <StatCard
          icon={Percent}
          title="Margen Bruto"
          value={`${kpis.margen.toFixed(1)}%`}
          delta="+0.5%"
          loading={loading.kpis}
          isUp={false}
        />
      </div>

      {/* GRÁFICO + PRODUCTOS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={`Ventas (${range} días)`}>
          <div className="h-80">
            {loading.ventas ? (
              <Skeleton className="h-full rounded-lg" />
            ) : (
              <Suspense fallback={<Skeleton className="h-full rounded-lg" />}>
                <DashboardChart data={ventas} />
              </Suspense>
            )}
          </div>
        </Card>
        <QuickProductCard className="lg:col-span-2" />
      </div>

      {/* PEDIDOS RECIENTES + MESAS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <RecentOrdersCard
          items={recent}
          loading={loading.recent}
          onVerTodo={() => nav("/pedidos")}
          className="lg:col-span-3"
        />
        <MesasQuickCard
          mesas={mesas}
          loading={loading.mesas}
          onIrMesas={() => nav("/mesas")}
          className="lg:col-span-2"
        />
      </div>
    </div>
  );
}

/* ---------- COMPONENTES BASE ---------- */

function Card({ title, action, className = "", children }) {
  return (
    <div className={`rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h3 className="text-lg font-semibold text-zinc-800">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-zinc-200/80 ${className}`}></div>;
}

// StatCard
function StatCard({ icon: Icon, title, value, delta, loading, isUp = true }) {
  const deltaColor = isUp ? "text-emerald-600" : "text-rose-600";
  return (
    <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
      {loading ? (
        <>
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="mt-4 h-5 w-3/4 rounded-md" />
          <Skeleton className="mt-2 h-8 w-1/2 rounded-md" />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-500">{title}</h3>
            <Icon className="h-5 w-5 text-zinc-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold text-zinc-900">{value}</span>
            {delta && <span className={`ml-2 text-sm font-medium ${deltaColor}`}>{delta}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- COMPONENTES DE SECCIÓN ---------- */

function RecentOrdersCard({ items = [], loading, onVerTodo, className = "" }) {
  const navigate = useNavigate();
  return (
    <Card
      className={className}
      title="Pedidos Recientes"
      action={
        <button
          onClick={onVerTodo}
          className="group inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-800"
        >
          Ver todos{" "}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </button>
      }
    >
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 font-medium">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Mesa</th>
                <th className="p-2">Detalle</th>
                <th className="p-2 text-right">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {items.length === 0 ? (
                <tr>
                  <td className="py-8 text-center text-zinc-500" colSpan={4}>
                    No hay pedidos recientes.
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-zinc-50/50 cursor-pointer"
                    onClick={() => navigate(`/pedidos/${p.id}`)}
                  >
                    <td className="p-2 font-mono text-zinc-600">#{p.id}</td>
                    <td className="p-2 font-medium text-zinc-800">
                      {p.mesa?.nombre || `M-${p.mesa_id ?? "?"}`}
                    </td>
                    <td className="p-2 truncate max-w-[200px] text-zinc-600">
                      {p.detalle?.map?.((d) => d?.nombre).join(", ") || p.resumen || "—"}
                    </td>
                    <td className="p-2 text-right">
                      <EstadoBadge estado={p.estado} />
                    </td>
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
  const styles =
    e.includes("sirv") || e.includes("listo")
      ? "bg-emerald-100 text-emerald-800"
      : e.includes("prep") || e.includes("pend")
      ? "bg-amber-100 text-amber-800"
      : "bg-zinc-100 text-zinc-800";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      {estado || "—"}
    </span>
  );
}

function MesasQuickCard({ mesas = [], loading, onIrMesas, className = "" }) {
  return (
    <Card
      title="Mesas Activas"
      action={
        <button
          onClick={onIrMesas}
          className="group inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-800"
        >
          Gestionar{" "}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </button>
      }
      className={className}
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 rounded-lg" />
          <Skeleton className="h-12 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-3">
          {mesas.length === 0 && (
            <p className="text-sm text-zinc-500 pt-2">
              No hay mesas activas en este momento.
            </p>
          )}
          {mesas.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3"
            >
              <div>
                <span className="font-semibold text-zinc-800">
                  {m.nombre || `Mesa ${m.id}`}
                </span>
                <span className="ml-2 text-xs text-zinc-500">
                  Cap. {m.capacidad ?? "-"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button title="Editar" className="text-zinc-500 hover:text-green-600">
                  <Edit size={16} />
                </button>
                <button title="Limpiar" className="text-zinc-500 hover:text-green-600">
                  <Trash2 size={16} />
                </button>
                <button title="Cerrar" className="text-zinc-500 hover:text-rose-600">
                  <X size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function QuickProductCard({ className }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    const runSearch = async (term) => {
      try {
        setLoading(true);
        const res = await searchMenuItems((term || "").trim(), {
          onlyActive: 1,
        });
        const clean = (res || []).filter(
          (it) => (it.activo ?? it.visible ?? true) && !it.eliminado
        );
        setItems(clean.slice(0, 3));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    const t = setTimeout(() => runSearch(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const goToMenu = () => nav("/menu");

  return (
    <Card
      title="Acceso Rápido a Productos"
      action={
        <button
          onClick={goToMenu}
          className="group inline-flex items-center gap-1 text-sm font-medium text-green-600 hover:text-green-800"
        >
          Ver Menú{" "}
          <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
        </button>
      }
      className={className}
    >
      <div className="relative mb-4">
        <Search
          size={18}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <input
          className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-3 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
          placeholder="Buscar un plato..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 rounded-lg" />
          <Skeleton className="h-16 rounded-lg" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-zinc-500 py-4">
          No se encontraron productos.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
              it.nombre
            )}&background=e5e7eb&color=6b7280&size=96`;

            const imgSrc = it.imagen_url
              ? proxyImg(it.imagen_url, 96, 96)
              : fallbackAvatar;

            return (
              <li
                key={it.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-zinc-50 p-2 hover:bg-zinc-100 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={imgSrc}
                    alt={it.nombre}
                    className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-zinc-800">
                      {it.nombre}
                    </div>
                    <div className="text-sm text-zinc-500">
                      {PEN.format(Number(it.precio || 0))}
                    </div>
                  </div>
                </div>
                <button
                  onClick={goToMenu}
                  className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-green-700 shadow-sm ring-1 ring-inset ring-zinc-300 hover:bg-zinc-50"
                >
                  Editar
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
