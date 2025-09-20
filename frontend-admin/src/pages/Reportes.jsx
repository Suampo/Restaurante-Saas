// src/pages/Reportes.jsx
import { useEffect, useMemo, useState } from "react";
import ExportDialog from "../components/ExportDialog";
import API from "../services/axiosInstance";

/* ---------- utils ---------- */
const fmtSoles = (n) =>
  `S/ ${Number(n ?? 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
const fmtNum = (n) => Number(n ?? 0).toLocaleString("es-PE");

/* Rango presets */
function todayISO() { const d = new Date(); return d.toISOString().slice(0, 10); }
function addDaysISO(iso, d) { const t = new Date(iso); t.setDate(t.getDate() + d); return t.toISOString().slice(0, 10); }
function monthStartISO(iso) { const t = new Date(iso); t.setDate(1); return t.toISOString().slice(0,10); }

const PRESETS = [
  { k: "today", label: "Hoy", get: () => { const t = todayISO(); return { from: t, to: t }; } },
  { k: "7", label: "Últimos 7 días", get: () => { const t = todayISO(); return { from: addDaysISO(t, -6), to: t }; } },
  { k: "30", label: "Últimos 30 días", get: () => { const t = todayISO(); return { from: addDaysISO(t, -29), to: t }; } },
  { k: "mtd", label: "Mes actual", get: () => { const t = todayISO(); return { from: monthStartISO(t), to: t }; } },
];

/* ---------- page ---------- */
export default function Reportes() {
  const def = PRESETS[1].get(); // últimos 7
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // datasets
  const [resumen, setResumen] = useState({ total: 0, pedidos: 0, avg_ticket: 0, items: 0 });
  const [diarias, setDiarias] = useState([]);      // [{day,total,pedidos}]
  const [porHora, setPorHora] = useState([]);      // [{hour,total,pedidos}]
  const [topItems, setTopItems] = useState([]);    // [{id,nombre,cantidad,total}]
  const [pagos, setPagos] = useState([]);          // [{metodo,total,count}]
  const [showExport, setShowExport] = useState(false);

  /* fetch */
  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();

    (async () => {
      try {
        setBusy(true);
        setErr("");

        const qs = { params: { from, to }, signal: ctrl.signal };
        const [r1, r2, r3, r4, r5] = await Promise.all([
          API.get("/reportes/resumen", qs),
          API.get("/reportes/ventas-diarias", qs),
          API.get("/reportes/por-hora", qs),
          API.get("/reportes/top-items", { ...qs, params: { ...qs.params, limit: 10 } }),
          API.get("/reportes/metodos-pago", qs),
        ]);

        if (!alive) return;
        setResumen(r1.data || {});
        setDiarias(Array.isArray(r2.data) ? r2.data : []);
        setPorHora(Array.isArray(r3.data) ? r3.data : []);
        setTopItems(Array.isArray(r4.data) ? r4.data : []);
        setPagos(Array.isArray(r5.data) ? r5.data : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.response?.data?.error || e?.message || "No se pudo cargar reportes");
      } finally {
        if (alive) setBusy(false);
      }
    })();

    return () => { alive = false; ctrl.abort(); };
  }, [from, to]);

  /* totales auxiliares */
  const totalPorHora = useMemo(() => porHora.reduce((a, b) => a + Number(b.total || 0), 0), [porHora]);
  const pagosTotal = useMemo(() => pagos.reduce((a,b)=>a+Number(b.total||0),0), [pagos]);

  /* export helpers (solo para botones de tablas locales) */
  const exportCSV = (rows, headers, name) => {
    const csv = [headers.join(",")]
      .concat(rows.map(r => headers.map(h => {
        const v = r[h];
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s;
      }).join(",")))
      .join("\n");
    const blob = new Blob([csv], { type:"text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const applyPreset = (k) => {
    const p = PRESETS.find(x => x.k === k);
    if (!p) return;
    const r = p.get();
    setFrom(r.from); setTo(r.to);
  };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
        <div className="flex flex-wrap items-end gap-2">
          <div className="mr-4">
            <h1 className="text-2xl font-semibold">Reportes</h1>
            <p className="text-sm text-neutral-600">Ventas, tendencias y productos más vendidos.</p>
          </div>

          {/* filtros */}
          <div className="ml-auto grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <div>
              <label htmlFor="rep-from" className="block text-xs text-neutral-600">Desde</label>
              <input id="rep-from" name="from" type="date"
                     className="rounded-lg border px-3 py-2 text-sm"
                     value={from} onChange={e=>setFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rep-to" className="block text-xs text-neutral-600">Hasta</label>
              <input id="rep-to" name="to" type="date"
                     className="rounded-lg border px-3 py-2 text-sm"
                     value={to} onChange={e=>setTo(e.target.value)} />
            </div>

            <div className="flex gap-1">
              {PRESETS.map(p => (
                <button key={p.k} type="button"
                        className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
                        onClick={() => applyPreset(p.k)}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* NUEVO: botón para exportaciones del backend */}
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={() => setShowExport(true)}
              title="Exportar datos (CSV)"
            >
              Exportar datos…
            </button>
          </div>
        </div>

        {/* estado */}
        <div className="min-h-[20px]">
          {err && <div className="mt-3 rounded border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{err}</div>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-3 md:grid-cols-4" aria-busy={busy ? "true":"false"}>
        <Kpi title="Ventas" value={fmtSoles(resumen.total)} sub={diarias.length ? `${diarias.length} días` : ""}/>
        <Kpi title="Pedidos" value={fmtNum(resumen.pedidos)} sub={`Ticket prom.: ${fmtSoles(resumen.avg_ticket)}`}/>
        <Kpi title="Ticket promedio" value={fmtSoles(resumen.avg_ticket)} sub="por pedido"/>
        <Kpi title="Ítems vendidos" value={fmtNum(resumen.items)} sub="en el período"/>
      </div>

      {/* curva + por hora */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Ventas diarias">
          <TrendChart data={diarias.map(d => ({ x: d.day, y: Number(d.total||0) }))} />
          <div className="mt-3 flex justify-between text-xs text-neutral-600">
            <span>{diarias[0]?.day ?? ""}</span>
            <span>{diarias[diarias.length-1]?.day ?? ""}</span>
          </div>
          <div className="mt-3">
            <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
                    onClick={() => exportCSV(diarias, ["day","total","pedidos"], "ventas-diarias")}>
              Exportar CSV
            </button>
          </div>
        </Card>

        <Card title="Ventas por hora (0–23)">
          <HoursBars data={porHora.map(h => ({ hour: h.hour, total: Number(h.total||0) }))}/>
          <p className="mt-3 text-sm text-neutral-600">
            Total en gráfico: <strong>{fmtSoles(totalPorHora)}</strong>
          </p>
        </Card>

        <Card title="Métodos de pago">
          {pagos.length === 0 && <Empty>Sin datos</Empty>}
          <ul className="space-y-2">
            {pagos.map((p) => {
              const pct = pagosTotal > 0 ? (100 * Number(p.total||0) / pagosTotal) : 0;
              return (
                <li key={p.metodo} className="rounded border p-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{p.metodo || "—"}</span>
                    <span className="tabular-nums">{fmtSoles(p.total)} · {fmtNum(p.count||0)} pedidos</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-neutral-100">
                    <div className="h-2 rounded bg-emerald-500" style={{ width: `${pct}%` }}/>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* top productos */}
      <Card title="Top productos">
        {topItems.length === 0 && <Empty>Sin datos</Empty>}
        {topItems.length > 0 && (
          <>
            <div className="overflow-auto">
              <table className="min-w-[640px] w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2">Producto</th>
                    <th className="text-right">Cantidad</th>
                    <th className="text-right">Ventas</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2">{r.nombre}</td>
                      <td className="text-right">{fmtNum(r.cantidad)}</td>
                      <td className="text-right">{fmtSoles(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <button className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
                      onClick={() => exportCSV(topItems, ["id","nombre","cantidad","total"], "top-items")}>
                Exportar CSV
              </button>
            </div>
          </>
        )}
      </Card>

      {/* Dialogo de exportación del BACKEND */}
      <ExportDialog
        open={showExport}
        onClose={() => setShowExport(false)}
        from={from}
        to={to}
        // restaurantId={MI_RESTAURANT_ID} // pásalo solo si tu backend no lo saca del JWT
      />
    </section>
  );
}

/* ---------- UI bits ---------- */
function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
      {title ? <h3 className="mb-2 text-lg font-semibold">{title}</h3> : null}
      {children}
    </div>
  );
}
function Empty({ children }) {
  return <div className="rounded border border-dashed p-6 text-center text-neutral-500">{children}</div>;
}
function Kpi({ title, value, sub }) {
  return (
    <div className="min-h-[96px] rounded-2xl bg-white p-4 shadow ring-1 ring-black/5">
      <div className="text-sm text-neutral-600">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}

/* ---------- charts sin librerías ---------- */
function TrendChart({ data }) {
  const w = 640, h = 180, pad = 10;
  const arr = Array.isArray(data) ? data : [];
  const ys = arr.map(p => p.y);
  const min = Math.min(0, ...ys), max = Math.max(1, ...ys);
  const nx = arr.length > 1 ? (w - pad*2) / (arr.length - 1) : 0;

  const points = arr.map((p, i) => {
    const x = pad + i*nx;
    const y = pad + (h - pad*2) * (1 - ((p.y - min) / (max - min || 1)));
    return [x,y];
  });

  const path = points.map((p,i)=> (i? "L":"M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path
    ? path + ` L ${pad + (arr.length-1)*nx} ${h-pad} L ${pad} ${h-pad} Z`
    : "";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      <rect x="0" y="0" width={w} height={h} fill="white" rx="8" />
      <path d={area} fill="rgba(16,185,129,0.12)" />
      <path d={path} fill="none" stroke="rgb(16,185,129)" strokeWidth="2.5" />
      {points.map((p,i)=>(<circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill="rgb(16,185,129)" />))}
    </svg>
  );
}

function HoursBars({ data }) {
  const arr = Array.from({length:24}, (_,h)=> {
    const f = data.find(d=>Number(d.hour)===h);
    return { hour:h, total:Number(f?.total||0) };
  });
  const max = Math.max(1, ...arr.map(a=>a.total));
  return (
    <div className="grid grid-cols-12 gap-2">
      {arr.map(({hour,total})=>{
        const pct = (100 * total / max);
        return (
          <div key={hour} className="flex flex-col items-center">
            <div className="flex h-32 w-3 items-end rounded bg-neutral-100">
              <div className="w-3 rounded bg-emerald-500" style={{ height: `${pct}%` }} />
            </div>
            <div className="mt-1 text-[10px] text-neutral-600">{hour}</div>
          </div>
        );
      })}
    </div>
  );
}
