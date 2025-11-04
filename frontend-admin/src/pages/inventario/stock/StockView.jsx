// src/pages/inventario/StockView.jsx
import { useEffect, useMemo, useState } from "react";
import { inv } from "../../../services/inventarioApi";
import { Search, Download, ArrowDownUp, ChevronLeft, ChevronRight, CheckCircle2, TriangleAlert, Boxes, PackageX } from "lucide-react";

// --- UTILS ---
const fmt2 = (n) => Number(n ?? 0).toFixed(2);

// --- Sub-componentes de UI ---
function StatusBadge({ isLow }) {
    const styles = isLow
        ? "bg-rose-100 text-rose-800"
        : "bg-emerald-100 text-emerald-800";
    const Icon = isLow ? TriangleAlert : CheckCircle2;
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
            <Icon size={12} />
            {isLow ? "Bajo" : "OK"}
        </span>
    );
}

function StatCard({ icon: Icon, label, value, loading }) {
    return (
        <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-zinc-600">
                <Icon size={16} /> {label}
            </div>
            {loading ? (
                <div className="mt-2 h-8 w-1/2 animate-pulse rounded-md bg-zinc-200/80" />
            ) : (
                <div className="mt-1 text-3xl font-bold text-zinc-900">{value}</div>
            )}
        </div>
    );
}

// --- Componente Principal ---
export default function StockView() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("nombre");
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // --- Lógica de datos (RESTAURADA) ---
  const load = async () => {
    try {
      setLoading(true);
      const data = await inv.stock(false);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("inv:changed", h);
    return () => window.removeEventListener("inv:changed", h);
  }, []);

  useEffect(() => setPage(1), [q, sort, perPage]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let arr = rows;
    if (t) arr = rows.filter((r) => (r.nombre || "").toLowerCase().includes(t));
    if (sort === "nombre")
      arr = [...arr].sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    if (sort === "stockDesc")
      arr = [...arr].sort((a, b) => Number(b.cantidad) - Number(a.cantidad));
    if (sort === "stockAsc")
      arr = [...arr].sort((a, b) => Number(a.cantidad) - Number(b.cantidad));
    return arr;
  }, [rows, q, sort]);

  const lowCount = useMemo(() => filtered.filter((r) => Number(r.cantidad) <= Number(r.stock_min)).length, [filtered]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const start = (page - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  const exportCsv = () => {
    const header = ["insumo", "unidad", "stock", "minimo"];
    const csv =
      header.join(",") +
      "\n" +
      filtered
        .map((r) => [r.nombre, r.unidad, fmt2(r.cantidad), fmt2(r.stock_min)].join(","))
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* --- Encabezado y Estadísticas --- */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Stock de Inventario</h1>
        <p className="text-zinc-500">Supervisa las cantidades actuales y mínimas de tus insumos.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Boxes} label="Total de Insumos" value={filtered.length} loading={loading} />
          <StatCard icon={PackageX} label="Insumos bajos de stock" value={lowCount} loading={loading} />
      </div>
      
      {/* --- Panel Principal de la Tabla --- */}
      <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
        {/* --- Barra de Controles --- */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-grow sm:max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              id="stock-search"
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-10 pr-3 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Buscar insumo..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
             <div className="relative">
                <ArrowDownUp size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <select
                    id="stock-sort" value={sort} onChange={(e) => setSort(e.target.value)}
                    className="appearance-none w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-8 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
                >
                    <option value="nombre">Ordenar A-Z</option>
                    <option value="stockDesc">Mayor Stock</option>
                    <option value="stockAsc">Menor Stock</option>
                </select>
             </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
            >
              <Download size={16} />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* --- Tabla de Datos --- */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-zinc-500 font-medium">
              <tr>
                <th className="p-2">Insumo</th>
                <th className="p-2">Unidad</th>
                <th className="p-2 text-right">Stock Actual</th>
                <th className="p-2 text-right">Stock Mínimo</th>
                <th className="p-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200">
              {loading ? (
                Array.from({ length: perPage }).map((_, i) => (
                  <tr key={i}><td colSpan="5" className="p-4"><div className="h-5 animate-pulse rounded bg-zinc-200" /></td></tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr><td colSpan="5" className="py-12 text-center text-zinc-500">No se encontraron insumos.</td></tr>
              ) : (
                pageItems.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-50/50">
                    <td className="p-2 font-medium text-zinc-800">{r.nombre}</td>
                    <td className="p-2">{r.unidad}</td>
                    <td className="p-2 text-right font-mono">{fmt2(r.cantidad)}</td>
                    <td className="p-2 text-right font-mono text-zinc-500">{fmt2(r.stock_min)}</td>
                    <td className="p-2 text-center"><StatusBadge isLow={Number(r.cantidad) <= Number(r.stock_min)} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* --- Paginación --- */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600">
                <span>Mostrar</span>
                <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}
                    className="rounded-lg border-zinc-300 py-1 text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500">
                    <option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                </select>
                <span>de {filtered.length} resultados</span>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
                    <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-zinc-700">Página {page} de {pageCount}</span>
                <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} className="p-2 rounded-lg border border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-100 disabled:opacity-50">
                    <ChevronRight size={16} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}