// src/pages/inventario/AlertasView.jsx

import { useEffect, useState } from "react";
import { inv } from "../../../services/inventarioApi";
import { TriangleAlert, CircleAlert, FileDown, PlusCircle, CheckCircle2, X, Save, Loader2 } from 'lucide-react';

// --- COMPONENTES DE UI ANIDADOS ---

// Insignia para mostrar la severidad de la alerta
function SeverityBadge({ severity }) {
  const isCritical = severity === 'critico';
  const styles = isCritical ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800';
  const Icon = isCritical ? CircleAlert : TriangleAlert;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles}`}>
      <Icon size={12} />
      {isCritical ? 'Crítico' : 'Bajo'}
    </span>
  );
}

// Modal para reponer stock (reemplaza los `prompt`)
function ReponishModal({ item, almacenes, onClose, onSave }) {
    const [data, setData] = useState({
        cantidad: Math.max(0, (item.stock_min || 0) - (item.cantidad || 0)).toFixed(2),
        costo_unit: '',
        almacen_id: almacenes?.[0]?.id || '',
    });
    const [isSaving, setIsSaving] = useState(false);

    const set = (k, v) => setData(s => ({ ...s, [k]: v }));

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave(item, data);
        setIsSaving(false);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full text-zinc-500 hover:bg-zinc-100"><X size={20}/></button>
                <h3 className="text-xl font-bold text-zinc-900">Reponer Insumo</h3>
                <p className="text-zinc-600">Estás añadiendo stock para: <strong>{item.nombre}</strong></p>

                <form onSubmit={handleSave} className="mt-6 space-y-4">
                    <div>
                        <label htmlFor="cantidad" className="block text-sm font-medium text-zinc-700">Cantidad a reponer ({item.unidad})</label>
                        <input id="cantidad" type="number" step="any" min="0.01" value={data.cantidad} onChange={e => set('cantidad', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" required />
                    </div>
                     <div>
                        <label htmlFor="costo_unit" className="block text-sm font-medium text-zinc-700">Costo unitario (S/) - Opcional</label>
                        <input id="costo_unit" type="number" step="any" min="0" value={data.costo_unit} onChange={e => set('costo_unit', e.target.value)} placeholder="0.00"
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" />
                    </div>
                    <div>
                        <label htmlFor="almacen_id" className="block text-sm font-medium text-zinc-700">Almacén de destino</label>
                        <select id="almacen_id" value={data.almacen_id} onChange={e => set('almacen_id', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" required>
                            {almacenes.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400">
                             {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                             {isSaving ? 'Guardando...' : 'Guardar Entrada'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL ---

export default function AlertasView() {
  const [rows, setRows] = useState([]);
  const [alms, setAlms] = useState([]);
  const [soloCriticos, setSoloCriticos] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalItem, setModalItem] = useState(null); // Estado para controlar el modal

  const load = async () => {
    try {
      setLoading(true);
      const [r, a] = await Promise.all([inv.stock(true), inv.almacenes()]);
      setRows(Array.isArray(r) ? r : []);
      setAlms(Array.isArray(a) ? a : []);
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

  const n = (v) => Number(v ?? 0);
  const fmt = (v, d = 2) => n(v).toFixed(d);
  const falta = (r) => Math.max(n(r.stock_min) - n(r.cantidad), 0);
  const severidad = (r) => {
    const min = n(r.stock_min);
    const c = n(r.cantidad);
    if (min <= 0) return 'ok';
    const ratio = c / min;
    return c <= 0 || ratio < 0.2 ? "critico" : "bajo";
  };

  const filtered = rows.filter((r) => (soloCriticos ? severidad(r) === "critico" : true));

  // Lógica para registrar la entrada desde el modal
  const handleSaveReponish = async (item, formData) => {
    try {
        const cant = Number(formData.cantidad);
        if (!Number.isFinite(cant) || cant <= 0) throw new Error("Cantidad inválida.");
        let costo = formData.costo_unit;
        costo = costo === "" ? undefined : Number(costo);
        if (costo !== undefined && (!Number.isFinite(costo) || costo < 0)) throw new Error("Costo inválido.");

        await inv.crearMov({
            tipo: "in",
            insumo_id: item.id,
            almacen_id: formData.almacen_id,
            cantidad: cant,
            costo_unit: costo,
            origen: "Reposición",
        });
        setModalItem(null); // Cerrar modal
        window.dispatchEvent(new CustomEvent("inv:changed")); // Recargar datos
    } catch (e) {
        alert(e?.response?.data?.error || e.message || "No se pudo registrar la entrada");
    }
  };
  
  const exportCsv = () => { /* ...lógica de exportación sin cambios... */ };

  return (
    <>
      {modalItem && (
        <ReponishModal
            item={modalItem}
            almacenes={alms}
            onClose={() => setModalItem(null)}
            onSave={handleSaveReponish}
        />
      )}
      <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
                <h3 className="text-xl font-bold text-zinc-900 inline-flex items-center gap-2">
                    <TriangleAlert className="text-amber-500"/>
                    Alertas de Bajo Stock
                </h3>
                {!loading && <p className="text-zinc-600">{filtered.length} insumos requieren atención.</p>}
            </div>
            <div className="flex items-center gap-3">
                <label htmlFor="solo-criticos" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-zinc-700">
                    <input type="checkbox" id="solo-criticos" checked={soloCriticos} onChange={e => setSoloCriticos(e.target.checked)} className="sr-only peer" />
                    <div className="relative w-10 h-6 rounded-full bg-zinc-300 peer-checked:bg-green-600 transition-colors after:content-[''] after:absolute after:top-1 after:left-1 after:w-4 after:h-4 after:rounded-full after:bg-white after:transition-transform after:peer-checked:translate-x-full" />
                    <span>Solo críticos</span>
                </label>
                <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100">
                    <FileDown size={16}/> <span className="hidden sm:inline">Exportar</span>
                </button>
            </div>
        </div>
        <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
                <thead className="text-left text-zinc-500 font-medium">
                    <tr>
                        <th className="p-2">Insumo</th>
                        <th className="p-2 text-right">Stock Actual</th>
                        <th className="p-2 text-right">Stock Mínimo</th>
                        <th className="p-2 text-right">Faltante</th>
                        <th className="p-2">Severidad</th>
                        <th className="p-2 text-right">Acción</th>
                    </tr>
                </thead>
                <tbody>
                {loading ? (
                    // Skeleton Loader
                    Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-b border-zinc-200">
                            <td className="p-3"><div className="h-4 w-3/4 rounded bg-zinc-200 animate-pulse"/></td>
                            <td className="p-3"><div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse ml-auto"/></td>
                            <td className="p-3"><div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse ml-auto"/></td>
                            <td className="p-3"><div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse ml-auto"/></td>
                            <td className="p-3"><div className="h-5 w-20 rounded-full bg-zinc-200 animate-pulse"/></td>
                            <td className="p-3"><div className="h-7 w-24 rounded-lg bg-zinc-200 animate-pulse ml-auto"/></td>
                        </tr>
                    ))
                ) : filtered.length === 0 ? (
                    // Estado Vacío
                    <tr>
                        <td colSpan={6} className="py-20 text-center">
                            <CheckCircle2 size={48} className="mx-auto text-green-500" />
                            <h4 className="mt-4 text-lg font-semibold text-zinc-800">¡Todo en orden!</h4>
                            <p className="text-zinc-500">No hay alertas de bajo stock por el momento.</p>
                        </td>
                    </tr>
                ) : (
                    // Filas de la tabla
                    filtered.map((r) => (
                        <tr key={r.id} className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50/50">
                            <td className="p-2 font-medium text-zinc-800">{r.nombre} <span className="text-zinc-500 font-normal">({r.unidad})</span></td>
                            <td className="p-2 text-right font-mono">{fmt(r.cantidad)}</td>
                            <td className="p-2 text-right font-mono">{fmt(r.stock_min)}</td>
                            <td className="p-2 text-right font-mono font-semibold text-rose-600">{fmt(falta(r))}</td>
                            <td className="p-2"><SeverityBadge severity={severidad(r)} /></td>
                            <td className="p-2 text-right">
                                <button onClick={() => setModalItem(r)} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700">
                                    <PlusCircle size={14}/> Reponer
                                </button>
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </table>
        </div>
      </div>
    </>
  );
}