// src/pages/Inventario.jsx
import { useEffect, useMemo, useState } from "react";
import { inv } from "../services/inventarioApi";

/* Utils */
const fmt2 = (n) => Number(n ?? 0).toFixed(2);
const cls = (...a) => a.filter(Boolean).join(" ");

export default function Inventario() {
  const [tab, setTab] = useState(() => localStorage.getItem("inv:tab") || "stock");
  useEffect(() => localStorage.setItem("inv:tab", tab), [tab]);

  const tabs = [
    { key: "stock", label: "Stock" },
    { key: "insumos", label: "Insumos" },
    { key: "movimientos", label: "Movimientos" },
    { key: "alertas", label: "Alertas" },
    { key: "almacenes", label: "Almacenes" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventario</h1>

      <nav aria-label="Secciones de inventario" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cls(
              "rounded-lg px-3 py-1.5 text-sm transition",
              tab === t.key ? "bg-neutral-900 text-white" : "border hover:bg-neutral-50"
            )}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "stock" && <StockView />}
      {tab === "insumos" && <InsumosView />}
      {tab === "movimientos" && <MovView />}
      {tab === "alertas" && <AlertasView />}
      {tab === "almacenes" && <AlmacenesView />}
    </div>
  );
}

/* ---------- STOCK ---------- */
function StockView() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("nombre"); // nombre | stockDesc | stockAsc
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

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

  const lowCount = filtered.filter((r) => Number(r.cantidad) <= Number(r.stock_min)).length;
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
    <Card>
      <div aria-busy={loading ? "true" : "false"}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label htmlFor="stock-search" className="sr-only">Buscar insumo</label>
          <input
            id="stock-search"
            name="q"
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar insumo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <label htmlFor="stock-sort" className="sr-only">Ordenar por</label>
          <select
            id="stock-sort"
            name="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            title="Ordenar por"
          >
            <option value="nombre">Orden: nombre</option>
            <option value="stockDesc">Orden: stock (mayor→menor)</option>
            <option value="stockAsc">Orden: stock (menor→mayor)</option>
          </select>

          <label htmlFor="stock-perpage" className="sr-only">Por página</label>
          <select
            id="stock-perpage"
            name="per_page"
            value={perPage}
            onChange={(e) => setPerPage(Number(e.target.value))}
            className="rounded-lg border px-3 py-2 text-sm"
            title="Por página"
          >
            <option value={10}>10 / pág.</option>
            <option value={20}>20 / pág.</option>
            <option value={50}>50 / pág.</option>
          </select>

          <button
            onClick={exportCsv}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            title="Exportar CSV"
          >
            Exportar
          </button>

          <div className="ml-auto text-sm text-neutral-600">
            {filtered.length} ítems ·{" "}
            <span className={lowCount ? "text-red-600 font-medium" : ""}>
              {lowCount} bajo stock
            </span>
          </div>
        </div>

        {loading ? (
          <SkeletonTable rows={6} />
        ) : (
          <>
            <div className="overflow-auto">
              <table className="min-w-[680px] w-full text-sm">
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="py-2">Insumo</th>
                    <th>Unidad</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Mínimo</th>
                    <th className="text-right">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((r) => {
                    const isLow = Number(r.cantidad) <= Number(r.stock_min);
                    return (
                      <tr key={r.id} className="border-t">
                        <td className="py-2">{r.nombre}</td>
                        <td>{r.unidad}</td>
                        <td className="text-right">{fmt2(r.cantidad)}</td>
                        <td className="text-right">{fmt2(r.stock_min)}</td>
                        <td className="text-right">
                          <span
                            className={cls(
                              "inline-block rounded-full border px-2 py-0.5 text-xs",
                              isLow
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700"
                            )}
                          >
                            {isLow ? "Bajo" : "OK"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {pageItems.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-neutral-500">
                        Sin resultados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-neutral-600">
                Página {page} de {pageCount}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={page >= pageCount}
                  className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------- ALERTAS ---------- */
function AlertasView() {
  const [rows, setRows] = useState([]);
  const [alms, setAlms] = useState([]);
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [r, a] = await Promise.all([inv.stock(true), inv.almacenes()]);
      setRows(Array.isArray(r) ? r : []);
      setAlms(Array.isArray(a) ? a : []);
    } catch (e) {
      console.error("alertas.load:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("inv:changed", onChanged);
    return () => window.removeEventListener("inv:changed", onChanged);
  }, []);

  // Helpers
  const n = (v) => Number(v ?? 0);
  const fmt = (v, d = 2) => n(v).toFixed(d);
  const falta = (r) => Math.max(n(r.stock_min) - n(r.cantidad), 0);
  const severidad = (r) => {
    const min = n(r.stock_min);
    const c = n(r.cantidad);
    const ratio = min > 0 ? c / min : 0;
    return c <= 0 || ratio < 0.2 ? "critico" : "bajo";
  };

  const filtered = rows.filter((r) => (soloCriticos ? severidad(r) === "critico" : true));
  const totalFaltante = filtered.reduce((acc, r) => acc + falta(r), 0);
  const totalAlertas = filtered.length;

  const quickEntrada = async (r) => {
    try {
      const cantStr = prompt(
        `¿Cuánto repones de "${r.nombre}"? (unidad: ${r.unidad})`,
        fmt(falta(r), 2)
      );
      if (cantStr == null) return;
      const cant = Number(cantStr);
      if (!Number.isFinite(cant) || cant <= 0) {
        alert("Cantidad inválida.");
        return;
      }

      let costo = prompt("Costo unitario (opcional). Deja vacío si no aplica:", "");
      costo = costo === "" || costo == null ? "" : Number(costo);
      if (costo !== "" && (!Number.isFinite(costo) || costo < 0)) {
        alert("Costo inválido.");
        return;
      }

      let almacen_id = alms?.[0]?.id || "";
      if (alms.length > 1) {
        const nombreLista = alms.map((a, i) => `${i + 1}. ${a.nombre}`).join("\n");
        const idxStr = prompt(
          `¿A qué almacén entra?\n${nombreLista}\n(Ingresa el número, default 1)`,
          "1"
        );
        const idx = Math.max(1, Math.min(alms.length, Number(idxStr) || 1));
        almacen_id = alms[idx - 1].id;
      }

      await inv.crearMov({
        tipo: "in",
        insumo_id: r.id,
        almacen_id,
        cantidad: cant,
        costo_unit: costo === "" ? undefined : costo,
        origen: "Reposición",
      });

      window.dispatchEvent(new CustomEvent("inv:changed"));
    } catch (e) {
      console.error("quickEntrada:", e);
      alert(e?.response?.data?.error || "No se pudo registrar la entrada");
    }
  };

  const exportCsv = () => {
    const head = ["Insumo", "Unidad", "Stock", "Minimo", "Faltan", "Severidad"];
    const lines = filtered.map((r) => [
      (r.nombre ?? "").replaceAll('"', '""'),
      r.unidad ?? "",
      fmt(r.cantidad),
      fmt(r.stock_min),
      fmt(falta(r)),
      severidad(r),
    ]);
    const csv =
      head.join(",") +
      "\n" +
      lines.map((arr) => arr.map((c) => (/,|\s/.test(String(c)) ? `"${c}"` : c)).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "alertas-inventario.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5" aria-busy={loading ? "true" : "false"}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Bajo stock</h3>
        <div className="flex items-center gap-2">
          <div className="text-sm text-neutral-600">
            {loading ? "Cargando…" : `${totalAlertas} alerta(s) · Faltan ${fmt(totalFaltante)}`}
          </div>
          <label htmlFor="alertas-crit" className="inline-flex items-center gap-2 text-sm">
            <input
              id="alertas-crit"
              name="solo_criticos"
              type="checkbox"
              className="h-4 w-4 rounded border-neutral-300 text-neutral-900"
              checked={soloCriticos}
              onChange={(e) => setSoloCriticos(e.target.checked)}
            />
            Solo críticos
          </label>
          <button
            onClick={exportCsv}
            className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-[720px] w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2">Insumo</th>
              <th>Unidad</th>
              <th className="text-right">Stock</th>
              <th className="text-right">Mínimo</th>
              <th className="text-right">Faltan</th>
              <th>Severidad</th>
              <th className="text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const sev = severidad(r);
              const falt = falta(r);
              const sevClass =
                sev === "critico"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-amber-50 text-amber-700 border-amber-200";
              return (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.nombre}</td>
                  <td>{r.unidad}</td>
                  <td className="text-right">{fmt(r.cantidad)}</td>
                  <td className="text-right">{fmt(r.stock_min)}</td>
                  <td className="text-right font-medium">{fmt(falt)}</td>
                  <td>
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs ${sevClass}`}>
                      {sev === "critico" ? "Crítico" : "Bajo"}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => quickEntrada(r)}
                      className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
                      title="Registrar entrada rápida"
                    >
                      Reponer
                    </button>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  Todo OK ✅
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  Cargando…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-neutral-500">
        * Un insumo se considera <strong>Crítico</strong> cuando su stock es 0 o menor al 20% del mínimo.
      </p>
    </div>
  );
}

/* ---------- INSUMOS ---------- */
function InsumosView() {
  const [rows, setRows] = useState([]);
  const [unis, setUnis] = useState([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    nombre: "",
    unidad_id: "",
    stock_min: "",
    costo_unit: "",
  });

  useEffect(() => {
    (async () => {
      const [ins, u] = await Promise.all([inv.insumos(), inv.unidades()]);
      setRows(ins || []);
      setUnis(u || []);
    })();
  }, []);

  const dedupUnis = [
    ...new Map(
      (unis || []).map((u) => [
        `${(u.abrev || "").toLowerCase()}|${(u.nombre || "").toLowerCase()}`,
        u,
      ])
    ).values(),
  ];

  const errs = {
    nombre:
      !form.nombre.trim()
        ? "Ingresa un nombre."
        : form.nombre.trim().length < 2
        ? "Demasiado corto."
        : "",
    unidad_id: !form.unidad_id ? "Selecciona una unidad." : "",
    stock_min:
      form.stock_min === "" || Number.isNaN(Number(form.stock_min)) || Number(form.stock_min) < 0
        ? "Mínimo ≥ 0."
        : "",
    costo_unit:
      form.costo_unit !== "" &&
      (Number.isNaN(Number(form.costo_unit)) || Number(form.costo_unit) < 0)
        ? "Costo ≥ 0 (o vacío)."
        : "",
  };
  const hasErr = Object.values(errs).some(Boolean);

  const onBlur = (k) => setTouched((s) => ({ ...s, [k]: true }));
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setTouched({ nombre: true, unidad_id: true, stock_min: true, costo_unit: true });
    if (hasErr || saving) return;

    try {
      setSaving(true);
      await inv.crear(form);
      setForm({ nombre: "", unidad_id: "", stock_min: "", costo_unit: "" });
      const ins = await inv.insumos();
      setRows(ins || []);
      toast("Insumo creado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => (r.nombre || "").toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Formulario */}
      <div className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5">
        <h3 className="mb-3 text-lg font-semibold">Nuevo insumo</h3>
        <form onSubmit={save} className="space-y-3" aria-busy={saving ? "true" : "false"}>
          <div>
            <label htmlFor="ins-nombre" className="block text-sm font-medium">Nombre</label>
            <input
              id="ins-nombre"
              name="nombre"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Ej: Tomate"
              value={form.nombre}
              onChange={(e) => set("nombre", e.target.value)}
              onBlur={() => onBlur("nombre")}
              aria-invalid={!!errs.nombre}
            />
            {touched.nombre && errs.nombre && (
              <p className="mt-1 text-xs text-red-600">{errs.nombre}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-1">
              <label htmlFor="ins-unidad" className="block text-sm font-medium">Unidad</label>
              <select
                id="ins-unidad"
                name="unidad_id"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={form.unidad_id || ""}
                onChange={(e) => set("unidad_id", e.target.value)}
                onBlur={() => onBlur("unidad_id")}
                aria-invalid={!!errs.unidad_id}
              >
                <option value="">— Selecciona —</option>
                {dedupUnis.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} {u.abrev ? `(${u.abrev})` : ""}
                  </option>
                ))}
              </select>
              {touched.unidad_id && errs.unidad_id && (
                <p className="mt-1 text-xs text-red-600">{errs.unidad_id}</p>
              )}
            </div>

            <div>
              <label htmlFor="ins-min" className="block text-sm font-medium">Stock mínimo</label>
              <input
                id="ins-min"
                name="stock_min"
                className="mt-1 w-full rounded-lg border px-3 py-2"
                type="number"
                min="0"
                step="0.01"
                placeholder="Ej: 5"
                value={form.stock_min}
                onChange={(e) => set("stock_min", e.target.value)}
                onBlur={() => onBlur("stock_min")}
                aria-invalid={!!errs.stock_min}
              />
              {touched.stock_min && errs.stock_min && (
                <p className="mt-1 text-xs text-red-600">{errs.stock_min}</p>
              )}
            </div>

            <div>
              <label htmlFor="ins-costo" className="block text-sm font-medium">Costo unitario</label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                  S/
                </span>
                <input
                  id="ins-costo"
                  name="costo_unit"
                  className="w-full rounded-lg border px-7 py-2"
                  type="number"
                  min="0"
                  step="0.0001"
                  placeholder="Opcional"
                  value={form.costo_unit}
                  onChange={(e) => set("costo_unit", e.target.value)}
                  onBlur={() => onBlur("costo_unit")}
                  aria-invalid={!!errs.costo_unit}
                />
              </div>
              {touched.costo_unit && errs.costo_unit && (
                <p className="mt-1 text-xs text-red-600">{errs.costo_unit}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="mt-1 rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Guardando…" : "Guardar insumo"}
          </button>

          <p className="text-xs text-neutral-500">
            Consejito: el <strong>stock mínimo</strong> activa alertas en la pestaña “Alertas”.
          </p>
        </form>
      </div>

      {/* Listado en tabla */}
      <div className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">Insumos</h3>
          <label htmlFor="ins-buscar" className="sr-only">Buscar insumo</label>
          <input
            id="ins-buscar"
            name="buscar"
            className="w-full max-w-xs rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar por nombre…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="overflow-auto">
          <table className="min-w-[560px] w-full text-sm">
            <thead>
              <tr className="text-left text-neutral-500">
                <th className="py-2">Nombre</th>
                <th>Unidad</th>
                <th className="text-right">Mínimo</th>
                <th className="text-right">Costo unit</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="py-2">{r.nombre}</td>
                  <td>{r.unidad}</td>
                  <td className="text-right">{Number(r.stock_min ?? 0).toFixed(2)}</td>
                  <td className="text-right">S/ {Number(r.costo_unit ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-neutral-500">
                    Sin insumos que coincidan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- MOVIMIENTOS ---------- */
function MovView() {
  const [rows, setRows] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [alms, setAlms] = useState([]);
  const [stockMap, setStockMap] = useState(new Map());
  const [saving, setSaving] = useState(false);

  const [f, setF] = useState({
    insumo_id: "",
    almacen_id: "",
    tipo: "in",
    cantidad: "",
    costo_unit: "",
    origen: "Compra",
  });

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const loadAll = async () => {
    const [mv, ins, al, st] = await Promise.all([
      inv.movimientos(),
      inv.insumos(),
      inv.almacenes(),
      inv.stock(false),
    ]);
    setRows(mv || []);
    setInsumos(ins || []);
    setAlms(al || []);
    setStockMap(new Map((st || []).map((r) => [String(r.id), r])));
    if (!f.insumo_id && ins?.[0]?.id) set("insumo_id", String(ins[0].id));
    if (!f.almacen_id && al?.[0]?.id) set("almacen_id", String(al[0].id));
  };

  useEffect(() => {
    loadAll();
    const onChanged = () => loadAll();
    window.addEventListener("inv:changed", onChanged);
    return () => window.removeEventListener("inv:changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sel = stockMap.get(String(f.insumo_id)) || {};
  const unidad = sel.unidad || "";
  const curr = Number(sel.cantidad ?? 0);

  const toNum = (s) => {
    if (s === "" || s == null) return NaN;
    return Number(String(s).replace(",", "."));
  };

  const qty = toNum(f.cantidad);
  const cost = toNum(f.costo_unit);
  const next = !Number.isFinite(qty) ? curr : f.tipo === "in" ? curr + qty : curr - qty;

  const errs = {
    insumo_id: !f.insumo_id ? "Selecciona insumo." : "",
    almacen_id: !f.almacen_id ? "Selecciona almacén." : "",
    cantidad: !Number.isFinite(qty) || qty <= 0 ? "Cantidad > 0 requerida." : "",
    costo_unit:
      f.tipo === "in" && f.costo_unit !== "" && (!Number.isFinite(cost) || cost < 0)
        ? "Costo ≥ 0 (o deja vacío)."
        : "",
  };
  const hasErr = Object.values(errs).some(Boolean);

  const limpiar = () =>
    setF((s) => ({
      ...s,
      cantidad: "",
      costo_unit: "",
      origen: s.tipo === "in" ? "Compra" : s.origen || "Consumo",
    }));

  const save = async (e) => {
    e.preventDefault();
    if (hasErr || saving) return;

    if (f.tipo === "out" && next < 0) {
      const ok = confirm(
        `La salida (${qty} ${unidad}) dejará el stock en ${next.toFixed(2)} ${unidad}.\n¿Registrar de todas formas?`
      );
      if (!ok) return;
    }

    try {
      setSaving(true);
      await inv.crearMov({
        tipo: f.tipo,
        insumo_id: f.insumo_id,
        almacen_id: f.almacen_id,
        cantidad: qty,
        costo_unit: f.tipo === "in" && Number.isFinite(cost) ? cost : undefined,
        origen: f.origen || (f.tipo === "in" ? "Compra" : "Consumo"),
      });
      limpiar();
      await loadAll();
      window.dispatchEvent(new CustomEvent("inv:changed"));
    } catch (e2) {
      console.error("crearMov:", e2);
      alert(e2?.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Formulario */}
      <form onSubmit={save} className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5 space-y-3" aria-busy={saving ? "true" : "false"}>
        <div className="grid gap-2 md:grid-cols-6">
          {/* Insumo */}
          <div className="md:col-span-2">
            <label htmlFor="mov-insumo" className="block text-sm font-medium">Insumo</label>
            <select
              id="mov-insumo"
              name="insumo_id"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={f.insumo_id}
              onChange={(e) => set("insumo_id", e.target.value)}
              aria-invalid={!!errs.insumo_id}
            >
              {insumos.length === 0 && <option value="">—</option>}
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
            {errs.insumo_id && <p className="mt-1 text-xs text-rose-600">{errs.insumo_id}</p>}
          </div>

          {/* Almacén */}
          <div>
            <label htmlFor="mov-almacen" className="block text-sm font-medium">Almacén</label>
            <select
              id="mov-almacen"
              name="almacen_id"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={f.almacen_id}
              onChange={(e) => set("almacen_id", e.target.value)}
              aria-invalid={!!errs.almacen_id}
            >
              {alms.length === 0 && <option value="">—</option>}
              {alms.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            {errs.almacen_id && <p className="mt-1 text-xs text-rose-600">{errs.almacen_id}</p>}
          </div>

          {/* Tipo */}
          <div>
            <label htmlFor="mov-tipo" className="block text-sm font-medium">Tipo</label>
            <select
              id="mov-tipo"
              name="tipo"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={f.tipo}
              onChange={(e) => {
                const v = e.target.value;
                set("tipo", v);
                set("origen", v === "in" ? "Compra" : "Consumo");
              }}
            >
              <option value="in">Entrada</option>
              <option value="out">Salida</option>
            </select>
          </div>

          {/* Cantidad */}
          <div>
            <label htmlFor="mov-cantidad" className="block text-sm font-medium">
              Cantidad ({unidad || "u"})
            </label>
            <input
              id="mov-cantidad"
              name="cantidad"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              placeholder="Ej: 5"
              inputMode="decimal"
              type="number"
              step="any"
              min="0"
              value={f.cantidad}
              onChange={(e) => set("cantidad", e.target.value)}
              aria-invalid={!!errs.cantidad}
            />
            {errs.cantidad && <p className="mt-1 text-xs text-rose-600">{errs.cantidad}</p>}
          </div>

          {/* Costo unit */}
          <div>
            <label htmlFor="mov-costo" className="block text-sm font-medium">
              Costo unit (S/) {f.tipo === "out" && <span className="text-neutral-500 text-xs">(no aplica)</span>}
            </label>
            <input
              id="mov-costo"
              name="costo_unit"
              className="mt-1 w-full rounded-lg border px-3 py-2 disabled:opacity-60"
              placeholder="Opcional"
              inputMode="decimal"
              type="number"
              step="any"
              min="0"
              value={f.costo_unit}
              onChange={(e) => set("costo_unit", e.target.value)}
              disabled={f.tipo === "out"}
              aria-invalid={!!errs.costo_unit}
            />
            {errs.costo_unit && <p className="mt-1 text-xs text-rose-600">{errs.costo_unit}</p>}
          </div>

          {/* Origen / Nota */}
          <div>
            <label htmlFor="mov-origen" className="block text-sm font-medium">Origen / Nota</label>
            <select
              id="mov-origen"
              name="origen"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={f.origen}
              onChange={(e) => set("origen", e.target.value)}
            >
              {f.tipo === "in" ? (
                <>
                  <option>Compra</option>
                  <option>Ajuste</option>
                  <option>Traspaso</option>
                </>
              ) : (
                <>
                  <option>Consumo</option>
                  <option>Merma</option>
                  <option>Ajuste</option>
                  <option>Traspaso</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Resumen de stock */}
        <div className="mt-2 grid gap-3 rounded-lg bg-neutral-50 p-3 text-sm md:grid-cols-3">
          <div>
            <span className="text-neutral-500">Stock actual:</span>{" "}
            <span className="font-medium">{curr.toFixed(2)} {unidad}</span>
          </div>
          <div>
            <span className="text-neutral-500">Quedará:</span>{" "}
            <span className={`font-semibold ${next < 0 ? "text-rose-600" : ""}`}>
              {Number.isFinite(next) ? next.toFixed(2) : curr.toFixed(2)} {unidad}
            </span>
          </div>
          <div className="text-neutral-500">
            Mínimo: <span className="font-medium">{Number(sel.stock_min ?? 0).toFixed(2)} {unidad}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-white disabled:opacity-60"
            disabled={saving || hasErr}
          >
            {saving ? "Guardando…" : "Registrar movimiento"}
          </button>
          <button
            type="button"
            className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
            onClick={limpiar}
          >
            Limpiar
          </button>
          <span className="text-xs text-neutral-500">
            Tip: usa coma o punto para decimales; admitimos ambos.
          </span>
        </div>
      </form>

      {/* Tabla de movimientos */}
      <div className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5 overflow-auto">
        <table className="min-w-[820px] w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="py-2">Fecha</th>
              <th>Insumo</th>
              <th>Almacén</th>
              <th>Tipo</th>
              <th className="text-right">Cantidad</th>
              <th className="text-right">Costo unit </th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="py-2">{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.insumo}</td>
                <td>{r.almacen}</td>
                <td>{r.tipo === "in" || r.tipo === "entrada" ? "entrada" : "salida"}</td>
                <td className="text-right">{Number(r.cantidad || 0).toFixed(2)}</td>
                <td className="text-right">
                  {r.costo_unit != null && r.costo_unit !== ""
                    ? Number(r.costo_unit).toFixed(2)
                    : "—"}
                </td>
                <td>{r.origen || r.referencia || "-"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  Aún no hay movimientos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- ALMACENES ---------- */
function AlmacenesView() {
  const [rows, setRows] = useState([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const data = await inv.almacenes();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("inv:changed", onChanged);
    return () => window.removeEventListener("inv:changed", onChanged);
  }, []);

  const add = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    try {
      await inv.crearAlmacen(n);
      setNombre("");
      await load();
      window.dispatchEvent(new CustomEvent("inv:changed"));
      toast("Almacén creado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo crear");
    }
  };

  const rename = async (id) => {
    const curr = rows.find((r) => r.id === id);
    const nuevo = prompt("Nuevo nombre", curr?.nombre || "");
    if (!nuevo?.trim()) return;
    try {
      await inv.renombrarAlmacen(id, nuevo.trim());
      await load();
      window.dispatchEvent(new CustomEvent("inv:changed"));
      toast("Almacén renombrado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo renombrar");
    }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar almacén? (solo si no tiene movimientos)")) return;
    try {
      await inv.eliminarAlmacen(id);
      await load();
      window.dispatchEvent(new CustomEvent("inv:changed"));
      toast("Almacén eliminado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo eliminar");
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <h3 className="mb-2 font-semibold">Nuevo almacén</h3>
        <form onSubmit={add} className="space-y-3">
          <label htmlFor="alm-nombre" className="sr-only">Nombre</label>
          <input
            id="alm-nombre"
            name="nombre"
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Nombre (p.ej. Cocina)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <button className="rounded-lg bg-neutral-900 px-4 py-2 text-white">
            Agregar
          </button>
        </form>
      </Card>

      <Card>
        <h3 className="mb-2 font-semibold">Almacenes</h3>
        {loading ? (
          <ul className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="h-8 animate-pulse rounded bg-neutral-100" />
            ))}
          </ul>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2">
                <span>{r.nombre}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => rename(r.id)}
                    className="rounded-md border px-2 py-1 text-xs"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="py-2 text-sm text-neutral-500">Sin almacenes aún.</li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ---------- UI helpers ---------- */
function Card({ title, children }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow ring-1 ring-black/5">
      {title ? <h3 className="mb-3 font-semibold">{title}</h3> : null}
      {children}
    </div>
  );
}

function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
      ))}
    </div>
  );
}

/* Mini toast sin dependencias */
function toast(msg) {
  try {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className =
      "fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-neutral-900 px-3 py-2 text-sm text-white shadow-lg";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  } catch {}
}
