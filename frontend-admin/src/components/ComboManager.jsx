// src/components/ComboManager.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import EditModal from "./EditModal";
import {
  getCombos,
  createCombo,
  createComboV2,
  updateCombo,
  deleteCombo,
  uploadComboCover,
} from "../services/combosApi";


/* ... (Componentes Icon, Stepper, GrupoCard no cambian) ... */
const Icon = ({ name, className = "h-5 w-5" }) => { const icons = { add: <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />, arrowUp: <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />, arrowDown: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />, trash: <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.036-2.134H8.718c-1.126 0-2.037.955-2.037 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0" />, edit: <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />, price: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.826-1.106-2.156 0-2.982C10.544 8.22 11.27 8 12 8c.768 0 1.536.219 2.121.659l.879.659m0-2.818a4.5 4.5 0 00-6.364 0l-.879.659" />, image: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.65-1.65l1.65-1.65a2.25 2.25 0 013.182 0l3.3 3.3V5.25A2.25 2.25 0 0018 3H6a2.25 2.25 0 00-2.25 2.25v10.5z" />, }; return <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>{icons[name]}</svg>; };
const clampNum = (v, min = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.max(min, n) : min; };
const fmtSoles = (v) => `S/ ${Number(v || 0).toFixed(2)}`;
function Stepper({ label, value, onChange, min = 0 }) { return (<div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-600">{label}</label><div className="flex items-center"><div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-300 bg-white"><button type="button" onClick={() => onChange(Math.max(min, Number(value || 0) - 1))} className="h-9 w-9 text-gray-600 transition hover:bg-gray-100" aria-label={`Reducir ${label}`}>−</button><input type="number" min={min} className="h-9 w-14 appearance-none border-x border-gray-300 text-center text-sm font-medium outline-none" value={value} onChange={(e) => onChange(clampNum(e.target.value, min))} /><button type="button" onClick={() => onChange(Number(value || 0) + 1)} className="h-9 w-9 text-gray-600 transition hover:bg-gray-100" aria-label={`Aumentar ${label}`}>+</button></div></div></div>); }
function GrupoCard({ idx, total, g, cats, setField, moveUp, moveDown, remove, }) { const sugerencias = ["Entrada", "Fondo", "Bebida", "Postre"]; return (<div className="rounded-xl bg-gray-50 p-4 ring-1 ring-gray-200"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-600">{idx + 1}</span><h4 className="text-base font-semibold text-gray-800">Grupo #{idx + 1}</h4></div><div className="flex items-center gap-1"><button type="button" onClick={moveUp} disabled={idx === 0} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent"><Icon name="arrowUp" className="h-4 w-4" /></button><button type="button" onClick={moveDown} disabled={idx === total - 1} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent"><Icon name="arrowDown" className="h-4 w-4" /></button><button type="button" onClick={remove} className="rounded-md p-1.5 text-red-600 hover:bg-red-100"><Icon name="trash" className="h-4 w-4" /></button></div></div><div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2"><div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-600">Categoría</label><select value={g.categoriaId} onChange={(e) => setField("categoriaId", e.target.value)} className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"><option value="">— Selecciona una categoría —</option>{cats.map((c) => (<option key={c.id} value={c.id}>{c.nombre}</option>))}</select><p className="mt-1 text-xs text-gray-500">Los platos a elegir se filtran por esta categoría.</p></div><div className="flex flex-col gap-1.5"><label className="text-xs font-medium text-gray-600">Nombre del grupo</label><input value={g.nombre} onChange={(e) => setField("nombre", e.target.value)} className="w-full rounded-lg border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ej. Plato Principal" /><div className="mt-1 flex flex-wrap gap-2">{sugerencias.map((s) => (<button key={s} type="button" onClick={() => setField("nombre", s)} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100" title={`Usar “${s}”`}>{s}</button>))}</div></div></div><div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3"><Stepper label="Mínimo a elegir" value={g.min} onChange={(v) => setField("min", v)} min={0} /><Stepper label="Máximo a elegir" value={g.max} onChange={(v) => setField("max", v)} min={1} /></div></div>); }
function ComboCard({ combo, catNameById, onRename, onChangePrice, onRemove, onPickCover, isDeleting, isUploading }) {
  const { id, nombre, precio, cover_url, grupos = [] } = combo;
  const hasCover = typeof cover_url === "string" && cover_url.trim().length > 0;
  return (
    <div className="overflow-hidden rounded-xl bg-white ring-1 ring-gray-200">
      <div className="flex items-center gap-4 p-4">
        <div className="relative h-20 w-20 flex-shrink-0">
          <div className="h-full w-full overflow-hidden rounded-lg bg-gray-100">
            {hasCover ? <img src={cover_url} alt={nombre} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400"><Icon name="image" className="h-8 w-8" /></div>}
          </div>
          {(isUploading) && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 text-white"><div className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent"></div></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-800">{nombre}</p>
          <p className="mt-1 text-sm font-medium text-emerald-600">{fmtSoles(precio)}</p>
          {grupos.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {grupos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0)).map((g, i) => (
                <span key={i} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-gray-200">{g.nombre || catNameById[g.categoria_id] || "Grupo"}</span>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px border-t border-gray-200 bg-gray-100 md:grid-cols-4">
        <label className="flex cursor-pointer items-center justify-center gap-1.5 bg-white px-2.5 py-2 text-xs text-gray-600 transition hover:bg-gray-50">
          <Icon name="image" className="h-4 w-4" /><span>Imagen</span>
          <input type="file" accept="image/*" hidden onChange={(e) => onPickCover(id, e.target.files?.[0])} />
        </label>
        <button type="button" onClick={(e) => onRename(id, e)} className="flex items-center justify-center gap-1.5 bg-white px-2.5 py-2 text-xs text-gray-600 transition hover:bg-gray-50">
          <Icon name="edit" className="h-4 w-4" /><span>Nombre</span>
        </button>
        <button type="button" onClick={(e) => onChangePrice(id, e)} className="flex items-center justify-center gap-1.5 bg-white px-2.5 py-2 text-xs text-gray-600 transition hover:bg-gray-50">
          <Icon name="price" className="h-4 w-4" /><span>Precio</span>
        </button>
        <button type="button" onClick={() => onRemove(id)} disabled={isDeleting} className="flex items-center justify-center gap-1.5 bg-white px-2.5 py-2 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-60">
          <Icon name="trash" className="h-4 w-4" /><span>{isDeleting ? "Borrando..." : "Borrar"}</span>
        </button>
      </div>
    </div>
  );
}

export default function ComboManager({ cats: externalCats = [] }) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [cats, setCats] = useState(externalCats);
  const [combos, setCombos] = useState([]);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [grupos, setGrupos] = useState([{ categoriaId: "", nombre: "", min: 1, max: 1, orden: 1 }]);

  const [modalState, setModalState] = useState({
    isOpen: false,
    mode: null,
    combo: null,
    position: null,
  });

  const catNameById = useMemo(() => Object.fromEntries((cats || []).map((c) => [c.id, c.nombre])),[cats]);
  useEffect(() => { setCats(Array.isArray(externalCats) ? externalCats : []); }, [externalCats]);
  const fetchInitial = useCallback(async () => { try { const co = await getCombos(); setCombos(Array.isArray(co) ? co : []); } finally { setLoadingInitial(false); } }, []);
  const refreshQuiet = useCallback(async () => { try { const co = await getCombos(); setCombos(Array.isArray(co) ? co : []); } catch {} }, []);
  const initRan = useRef(false);
  useEffect(() => { if (initRan.current) return; initRan.current = true; fetchInitial(); }, [fetchInitial]);
  const patchCombo = (id, patch) => setCombos((prev) => prev.map((c) => c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c));
  const removeLocal = (id) => setCombos((prev) => prev.filter((c) => c.id !== id));
  const addLocal = (co) => setCombos((prev) => [co, ...prev]);
  const addGrupo = () => setGrupos((gs) => { const orden = (gs.at(-1)?.orden ?? gs.length) + 1; return [...gs, { categoriaId: "", nombre: "", min: 1, max: 1, orden }]; });
  const rmGrupo = (idx) => setGrupos((gs) => gs.filter((_, i) => i !== idx));
  const mv = (idx, dir) => setGrupos((gs) => { const j = idx + dir; if (j < 0 || j >= gs.length) return gs; const next = gs.slice(); [next[idx], next[j]] = [next[j], next[idx]]; return next.map((g, i) => ({ ...g, orden: i + 1 })); });
  const setField = (idx, key, val) => setGrupos((gs) => gs.map((g, i) => (i === idx ? { ...g, [key]: val } : g)));
  const add = async (e) => { e.preventDefault(); const n = nombre.trim(); const p = Number(precio); if (!n) return alert("Ingresa un nombre."); if (!Number.isFinite(p) || p < 0) return alert("Precio inválido."); const gruposValidos = grupos.map((g, i) => { const categoriaId = Number(g.categoriaId) || null; const nombreGrupo = (g.nombre || "").trim() || (categoriaId ? catNameById[categoriaId] : "") || null; const min = clampNum(g.min, 0); const max = Math.max(min || 1, clampNum(g.max, 1)); return { categoriaId, nombre: nombreGrupo, min, max, orden: i + 1 }; }).filter((g) => g.categoriaId); setCreating(true); const tempId = `tmp-${Date.now()}`; addLocal({ id: tempId, nombre: n, precio: p, cover_url: "", activo: true }); try { let created; if (gruposValidos.length > 0) { created = await createComboV2({ nombre: n, precio: p, grupos: gruposValidos, activo: true, }); } else { created = await createCombo({ nombre: n, precio: p, activo: true }); } if (created?.id) setCombos((prev) => prev.map((c) => (c.id === tempId ? created : c))); setNombre(""); setPrecio(""); setGrupos([{ categoriaId: "", nombre: "", min: 1, max: 1, orden: 1 }]); refreshQuiet(); } catch (err) { removeLocal(tempId); alert(err?.response?.data?.error || "No se pudo crear el combo"); console.error("createCombo:", err?.response?.data || err?.message); } finally { setCreating(false); } };
  
  const openRenameModal = (id, event) => {
    const comboToEdit = combos.find((x) => x.id === id);
    if (comboToEdit && event) {
      const rect = event.currentTarget.getBoundingClientRect();
      setModalState({ isOpen: true, mode: 'rename', combo: comboToEdit, position: { top: rect.bottom + 8, left: rect.left + rect.width / 2 } });
    }
  };

  const openPriceModal = (id, event) => {
    const comboToEdit = combos.find((x) => x.id === id);
    if (comboToEdit && event) {
      const rect = event.currentTarget.getBoundingClientRect();
      setModalState({ isOpen: true, mode: 'price', combo: comboToEdit, position: { top: rect.bottom + 8, left: rect.left + rect.width / 2 } });
    }
  };

  const handleCloseModal = () => {
    setModalState({ isOpen: false, mode: null, combo: null, position: null });
  };
  
 const handleSaveModal = async (newValue) => {
    const { mode, combo } = modalState;
    if (!combo) return;

    if (mode === 'rename') {
      const val = newValue.trim();
      if (!val) return;
      const oldName = combo.nombre;
      patchCombo(combo.id, { nombre: val });
      try {
        await updateCombo(combo.id, { nombre: val });
        refreshQuiet();
      } catch (e) {
        patchCombo(combo.id, { nombre: oldName });
        alert(e?.response?.data?.error || "No se pudo renombrar");
      }
    }

    if (mode === 'price') {
      const p = Number(newValue);
      if (!Number.isFinite(p) || p < 0) {
        return alert("Precio inválido.");
      }
      const oldPrice = combo.precio;
      patchCombo(combo.id, { precio: p });
      try {
        await updateCombo(combo.id, { precio: p });
        refreshQuiet();
      } catch (e) {
        patchCombo(combo.id, { precio: oldPrice });
        alert(e?.response?.data?.error || "No se pudo cambiar el precio");
      }
    }
  };
  const remove = async (id) => { if (!confirm("¿Eliminar combo? Esta acción no se puede deshacer.")) return; setDeletingId(id); const prev = combos; removeLocal(id); try { await deleteCombo(id); refreshQuiet(); } catch (e) { setCombos(prev); alert(e?.response?.data?.error || "No se pudo eliminar"); } finally { setDeletingId(null); } };
  const pickCover = async (id, file) => { if (!file) return; setUploadingId(id); patchCombo(id, (c) => { const base = c.cover_url || ""; if (!base) return {}; return { cover_url: `${base}${base.includes("?") ? "&" : "?"}_ts=${Date.now()}` }; }); try { const res = await uploadComboCover(id, file); if (res?.cover_url) patchCombo(id, { cover_url: res.cover_url }); else setImgVer((v) => ({ ...v, [id]: Date.now() })); refreshQuiet(); } catch { alert("No se pudo subir la imagen"); } finally { setUploadingId(null); } };

  return (
    <>
      <div className="rounded-2xl bg-gray-50/50 p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-bold text-gray-900">Gestor de Combos</h3>
          <p className="mt-1 text-sm text-gray-600">Crea y administra los menús y promociones de tu restaurante.</p>
        </div>
        
        {/* ================================================================= */}
        {/* ========= AQUÍ ESTÁ EL FORMULARIO PARA CREAR COMBOS ============= */}
        {/* ========= (Esta es la parte que había desaparecido) ============== */}
        {/* ================================================================= */}
        <form onSubmit={add} className="mb-8 space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Nombre del combo</label>
              <input className="w-full rounded-lg border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="Ej. Menú Ejecutivo" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={creating} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Precio (S/)</label>
              <input type="number" step="0.01" className="w-full rounded-lg border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" placeholder="0.00" value={precio} onChange={(e) => setPrecio(e.target.value)} disabled={creating} />
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 ring-1 ring-gray-900/5">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h4 className="text-base font-semibold text-gray-900">Grupos del combo</h4>
                <p className="mt-1 text-sm text-gray-600">Define las opciones que el cliente podrá elegir.</p>
              </div>
              <button type="button" onClick={addGrupo} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">
                <Icon name="add" className="h-4 w-4" />Agregar Grupo
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {grupos.map((g, idx) => (<GrupoCard key={idx} idx={idx} total={grupos.length} g={g} cats={cats} setField={(k, v) => setField(idx, k, v)} moveUp={() => mv(idx, -1)} moveDown={() => mv(idx, +1)} remove={() => rmGrupo(idx)} />))}
              {grupos.length === 0 && (<div className="text-center rounded-lg border-2 border-dashed border-gray-300 p-8"><p className="text-sm text-gray-500">Aún no hay grupos. ¡Agrega el primero!</p></div>)}
            </div>
          </div>
          <button type="submit" className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-800 disabled:opacity-60" disabled={creating}>
            {creating ? "Creando…" : "Crear Combo"}
          </button>
        </form>

        {/* LISTA DE COMBOS EXISTENTES */}
        <div className="border-t border-gray-200 pt-6">
          <h4 className="text-base font-semibold text-gray-900 mb-4">Combos Existentes</h4>
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {loadingInitial ? (
              Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-40 animate-pulse rounded-xl bg-gray-200" />))
            ) : combos.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 sm:col-span-1 lg:col-span-2">
                <p className="text-center text-sm text-gray-500">No has creado ningún combo todavía.</p>
              </div>
            ) : (
              combos.map((co) => (
                <ComboCard
                  key={co.id}
                  combo={co}
                  catNameById={catNameById}
                  onRename={openRenameModal}
                  onChangePrice={openPriceModal}
                  onRemove={remove}
                  onPickCover={pickCover}
                  isDeleting={deletingId === co.id}
                  isUploading={uploadingId === co.id}
                />
              ))
            )}
          </div>
        </div>
      </div>

      <EditModal
        isOpen={modalState.isOpen}
        onClose={handleCloseModal}
        onSave={handleSaveModal}
        position={modalState.position}
        title={modalState.mode === 'rename' ? 'Editar nombre del combo' : 'Cambiar precio del combo'}
        label={modalState.mode === 'rename' ? 'Nuevo nombre' : 'Nuevo precio (S/)'}
        initialValue={modalState.mode === 'rename' ? modalState.combo?.nombre || '' : modalState.combo?.precio || ''}
        inputType={modalState.mode === 'price' ? 'number' : 'text'}
        placeholder={modalState.mode === 'rename' ? 'Ej. Menú Ejecutivo' : '0.00'}
      />
    </>
  );
}