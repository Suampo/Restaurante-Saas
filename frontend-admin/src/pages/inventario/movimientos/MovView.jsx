// src/pages/inventario/MovView.jsx

import { useEffect, useState } from "react";
import { inv } from "../../../services/inventarioApi";
import { Save, RotateCcw, Loader2, ArrowDownLeft, ArrowUpRight, AlertCircle, History } from 'lucide-react';

// --- COMPONENTES DE UI ANIDADOS ---

// Componente para el selector de Entrada/Salida
function TypeSelector({ value, onChange }) {
  return (
    <div className="relative flex w-full rounded-lg bg-zinc-200/70 p-1">
      <span className={`absolute top-1 bottom-1 w-1/2 rounded-md bg-white shadow-sm transition-transform duration-300 ease-in-out ${value === 'out' ? 'translate-x-full' : 'translate-x-0'}`}/>
      <button type="button" onClick={() => onChange('in')} className="relative z-10 flex-1 inline-flex items-center justify-center gap-2 p-2 text-sm font-semibold">
        <ArrowDownLeft size={16} className="text-green-600"/> Entrada
      </button>
      <button type="button" onClick={() => onChange('out')} className="relative z-10 flex-1 inline-flex items-center justify-center gap-2 p-2 text-sm font-semibold">
        <ArrowUpRight size={16} className="text-amber-600"/> Salida
      </button>
    </div>
  );
}

// Componente para cada campo del formulario
function FormField({ label, id, error, children }) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-zinc-700">{label}</label>
            <div className="mt-1">{children}</div>
            {error && <p className="mt-1 text-xs text-rose-600 inline-flex items-center gap-1"><AlertCircle size={12}/>{error}</p>}
        </div>
    );
}

// Componente para la insignia de Entrada/Salida en la tabla
function InOutBadge({ type }) {
    const is_in = type === 'in' || type === 'entrada';
    const styles = is_in ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
    const Icon = is_in ? ArrowDownLeft : ArrowUpRight;
    
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
            <Icon size={12} />
            {is_in ? 'Entrada' : 'Salida'}
        </span>
    );
}


// --- COMPONENTE PRINCIPAL ---

export default function MovView() {
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
      inv.movimientos(), inv.insumos(), inv.almacenes(), inv.stock(false),
    ]);
    setRows(mv || []);
    setInsumos(ins || []);
    setAlms(al || []);
    setStockMap(new Map((st || []).map((r) => [String(r.id), r])));
    // Pre-seleccionar el primer valor si no hay nada seleccionado
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

  const toNum = (s) => (s === "" || s == null) ? NaN : Number(String(s).replace(",", "."));
  
  const qty = toNum(f.cantidad);
  const cost = toNum(f.costo_unit);
  const next = !Number.isFinite(qty) ? curr : f.tipo === "in" ? curr + qty : curr - qty;

  const errs = {
    insumo_id: !f.insumo_id ? "Selecciona insumo." : "",
    almacen_id: !f.almacen_id ? "Selecciona almacén." : "",
    cantidad: !Number.isFinite(qty) || qty <= 0 ? "Cantidad > 0 requerida." : "",
    costo_unit: f.tipo === "in" && f.costo_unit !== "" && (!Number.isFinite(cost) || cost < 0) ? "Costo ≥ 0 (o deja vacío)." : "",
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
      if (!window.confirm(`La salida (${qty} ${unidad}) dejará el stock en ${next.toFixed(2)} ${unidad}.\n¿Registrar de todas formas?`)) return;
    }
    try {
      setSaving(true);
      await inv.crearMov({
        tipo: f.tipo, insumo_id: f.insumo_id, almacen_id: f.almacen_id, cantidad: qty,
        costo_unit: f.tipo === "in" && Number.isFinite(cost) ? cost : undefined,
        origen: f.origen || (f.tipo === "in" ? "Compra" : "Consumo"),
      });
      limpiar();
      await loadAll();
      window.dispatchEvent(new CustomEvent("inv:changed"));
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo registrar el movimiento");
    } finally {
      setSaving(false);
    }
  };

  const handleTypeChange = (newType) => {
    set("tipo", newType);
    set("origen", newType === "in" ? "Compra" : "Consumo");
  };

  return (
    <div className="space-y-6">
        {/* --- INICIO DEL FORMULARIO --- */}
        <form onSubmit={save} className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg space-y-4" aria-busy={saving}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
                <div className="lg:col-span-2">
                    <FormField label="Tipo de Movimiento" id="mov-tipo">
                        <TypeSelector value={f.tipo} onChange={handleTypeChange} />
                    </FormField>
                </div>
                <div className="lg:col-span-2">
                    <FormField label="Insumo" id="mov-insumo" error={errs.insumo_id}>
                        <select id="mov-insumo" value={f.insumo_id} onChange={(e) => set("insumo_id", e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" aria-invalid={!!errs.insumo_id}>
                            {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
                        </select>
                    </FormField>
                </div>
                <div className="lg:col-span-2">
                    <FormField label="Almacén" id="mov-almacen" error={errs.almacen_id}>
                         <select id="mov-almacen" value={f.almacen_id} onChange={(e) => set("almacen_id", e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" aria-invalid={!!errs.almacen_id}>
                            {alms.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                    </FormField>
                </div>
                 <div className="lg:col-span-2">
                    <FormField label={`Cantidad (${unidad || "u"})`} id="mov-cantidad" error={errs.cantidad}>
                        <input id="mov-cantidad" type="number" step="any" min="0" inputMode="decimal" placeholder="Ej: 5.25"
                            value={f.cantidad} onChange={(e) => set("cantidad", e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" aria-invalid={!!errs.cantidad} />
                    </FormField>
                </div>
                <div className="lg:col-span-2">
                     <FormField label="Costo unit. (S/)" id="mov-costo" error={errs.costo_unit}>
                        <input id="mov-costo" type="number" step="any" min="0" inputMode="decimal" placeholder="Opcional"
                            value={f.costo_unit} onChange={(e) => set("costo_unit", e.target.value)}
                            disabled={f.tipo === "out"}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500 disabled:bg-zinc-100" aria-invalid={!!errs.costo_unit} />
                    </FormField>
                </div>
                <div className="lg:col-span-2">
                     <FormField label="Origen / Nota" id="mov-origen">
                        <select id="mov-origen" value={f.origen} onChange={(e) => set("origen", e.target.value)}
                            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500">
                            {f.tipo === 'in' ? <><option>Compra</option><option>Ajuste</option><option>Traspaso</option></>
                                            : <><option>Consumo</option><option>Merma</option><option>Ajuste</option><option>Traspaso</option></>}
                        </select>
                    </FormField>
                </div>
            </div>

            <div className="grid gap-4 rounded-lg bg-zinc-100/70 p-3 text-sm sm:grid-cols-3">
                <div><span className="text-zinc-500">Stock actual:</span> <strong className="text-zinc-800">{curr.toFixed(2)} {unidad}</strong></div>
                <div><span className="text-zinc-500">Quedará:</span> <strong className={next < 0 ? "text-rose-600" : "text-zinc-800"}>{Number.isFinite(next) ? next.toFixed(2) : curr.toFixed(2)} {unidad}</strong></div>
                <div><span className="text-zinc-500">Mínimo:</span> <strong className="text-zinc-800">{Number(sel.stock_min ?? 0).toFixed(2)} {unidad}</strong></div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
                <button type="submit" disabled={saving || hasErr}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400">
                    {saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                    {saving ? "Guardando..." : "Registrar Movimiento"}
                </button>
                <button type="button" onClick={limpiar}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100">
                    <RotateCcw size={14}/> Limpiar
                </button>
            </div>
        </form>
        {/* --- FIN DEL FORMULARIO --- */}

        {/* --- INICIO DE LA TABLA --- */}
        <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
            <h3 className="text-lg font-semibold text-zinc-800 mb-4 inline-flex items-center gap-2">
                <History size={20} /> Historial de Movimientos
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="text-left text-zinc-500 font-medium">
                        <tr>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Insumo</th>
                            <th className="p-2">Almacén</th>
                            <th className="p-2">Tipo</th>
                            <th className="p-2 text-right">Cantidad</th>
                            <th className="p-2 text-right">Costo Unit.</th>
                            <th className="p-2">Origen</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200">
                        {rows.length === 0 ? (
                            <tr><td className="py-12 text-center text-zinc-500" colSpan={7}>No hay movimientos registrados.</td></tr>
                        ) : (
                            rows.map((r) => (
                                <tr key={r.id} className="hover:bg-zinc-50/50">
                                    <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                                    <td className="p-2 font-medium text-zinc-800">{r.insumo}</td>
                                    <td className="p-2">{r.almacen}</td>
                                    <td className="p-2"><InOutBadge type={r.tipo} /></td>
                                    <td className="p-2 text-right font-mono">{Number(r.cantidad || 0).toFixed(2)}</td>
                                    <td className="p-2 text-right font-mono">
                                        {r.costo_unit != null && r.costo_unit !== "" ? `S/ ${Number(r.costo_unit).toFixed(2)}` : "—"}
                                    </td>
                                    <td className="p-2">{r.origen || r.referencia || "-"}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        {/* --- FIN DE LA TABLA --- */}
    </div>
  );
}