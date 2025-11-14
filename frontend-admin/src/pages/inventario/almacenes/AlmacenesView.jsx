// src/pages/inventario/AlmacenesView.jsx

import { useEffect, useState } from "react";
import { inv } from "../../../services/inventarioApi";
import { toast } from "../utils";
import { Warehouse, Plus, Pencil, Trash2, X, Save, Loader2 } from 'lucide-react';

// --- COMPONENTES DE UI ANIDADOS (MODALES) ---

// Modal para Renombrar Almacén
function RenameModal({ item, onClose, onSave }) {
    const [newName, setNewName] = useState(item.nombre);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!newName.trim() || newName.trim() === item.nombre) {
            onClose();
            return;
        }
        setIsSaving(true);
        await onSave(item.id, newName.trim());
        setIsSaving(false);
    };
    
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-zinc-900">Renombrar Almacén</h3>
                <p className="text-zinc-600">Ingresa el nuevo nombre para <strong>"{item.nombre}"</strong>.</p>
                <form onSubmit={handleSave} className="mt-6 space-y-4">
                     <div>
                        <label htmlFor="new-name" className="block text-sm font-medium text-zinc-700">Nuevo nombre</label>
                        <input id="new-name" type="text" value={newName} onChange={e => setNewName(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500" required autoFocus />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100">Cancelar</button>
                        <button type="submit" disabled={isSaving} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60">
                            {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Modal de Confirmación para Eliminar
function DeleteConfirmModal({ item, onClose, onConfirm }) {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        await onConfirm(item.id);
        // El modal se cierra desde el componente principal al recargar
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-rose-600">Confirmar Eliminación</h3>
                <p className="mt-2 text-zinc-600">¿Estás seguro de que quieres eliminar el almacén <strong>"{item.nombre}"</strong>? Esta acción no se puede deshacer.</p>
                <p className="mt-2 text-xs text-zinc-500">Nota: Solo podrás eliminarlo si no tiene movimientos de inventario asociados.</p>
                 <div className="flex justify-end gap-3 pt-6">
                    <button type="button" onClick={onClose} disabled={isDeleting} className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-60">Cancelar</button>
                    <button onClick={handleDelete} disabled={isDeleting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60">
                        {isDeleting ? <Loader2 className="animate-spin" size={16}/> : <Trash2 size={16}/>}
                        Sí, eliminar
                    </button>
                </div>
            </div>
        </div>
    );
}

// --- COMPONENTE PRINCIPAL ---

export default function AlmacenesView() {
  const [rows, setRows] = useState([]);
  const [nombre, setNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Estados para controlar los modales
  const [itemToEdit, setItemToEdit] = useState(null);
  const [itemToDelete, setItemToDelete] = useState(null);

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

  const triggerChange = () => window.dispatchEvent(new CustomEvent("inv:changed"));

  const add = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    try {
      setIsAdding(true);
      await inv.crearAlmacen(n);
      setNombre("");
      triggerChange();
      toast("Almacén creado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo crear");
    } finally {
        setIsAdding(false);
    }
  };

  const handleSaveRename = async (id, newName) => {
    try {
      await inv.renombrarAlmacen(id, newName);
      setItemToEdit(null); // Cierra el modal
      triggerChange();
      toast("Almacén renombrado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo renombrar");
    }
  };

  const handleConfirmDelete = async (id) => {
    try {
      await inv.eliminarAlmacen(id);
      setItemToDelete(null); // Cierra el modal
      triggerChange();
      toast("Almacén eliminado");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo eliminar");
    }
  };
  
  return (
    <>
      {itemToEdit && <RenameModal item={itemToEdit} onClose={() => setItemToEdit(null)} onSave={handleSaveRename} />}
      {itemToDelete && <DeleteConfirmModal item={itemToDelete} onClose={() => setItemToDelete(null)} onConfirm={handleConfirmDelete} />}

      <div className="rounded-2xl bg-white/70 p-5 shadow-lg shadow-zinc-200/50 backdrop-blur-lg">
        {/* --- FORMULARIO DE CREACIÓN --- */}
        <div className="pb-4 border-b border-zinc-200">
            <h3 className="text-lg font-semibold text-zinc-800">Agregar Nuevo Almacén</h3>
            <form onSubmit={add} className="flex items-center gap-2 mt-2">
                <input
                    id="alm-nombre" name="nombre" placeholder="Nombre (p.ej. Cocina, Barra, Despensa)"
                    value={nombre} onChange={(e) => setNombre(e.target.value)}
                    className="flex-grow w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
                <button type="submit" disabled={isAdding || !nombre.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400">
                    {isAdding ? <Loader2 className="animate-spin" size={16}/> : <Plus size={16}/>}
                    Agregar
                </button>
            </form>
        </div>

        {/* --- LISTA DE ALMACENES --- */}
        <div className="mt-4">
            {loading ? (
                // Skeleton Loader
                <ul className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <li key={i} className="flex items-center justify-between rounded-lg bg-zinc-100/80 p-3 animate-pulse">
                           <div className="h-5 w-1/3 rounded-md bg-zinc-200" />
                           <div className="flex gap-3">
                                <div className="h-6 w-6 rounded-full bg-zinc-200" />
                                <div className="h-6 w-6 rounded-full bg-zinc-200" />
                           </div>
                        </li>
                    ))}
                </ul>
            ) : rows.length === 0 ? (
                // Estado Vacío
                <div className="text-center py-12">
                    <Warehouse size={48} className="mx-auto text-zinc-400" />
                    <h4 className="mt-4 text-lg font-semibold text-zinc-800">Sin almacenes</h4>
                    <p className="text-zinc-500">Usa el formulario de arriba para crear tu primer almacén.</p>
                </div>
            ) : (
                // Lista de Almacenes
                <ul className="space-y-2">
                    {rows.map((r) => (
                        <li key={r.id} className="flex items-center justify-between rounded-lg p-3 hover:bg-zinc-100/80 transition-colors">
                            <span className="font-medium text-zinc-800">{r.nombre}</span>
                            <div className="flex gap-2">
                                <button onClick={() => setItemToEdit(r)} title="Renombrar" className="p-1.5 rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800 transition-colors">
                                    <Pencil size={16} />
                                </button>
                                <button onClick={() => setItemToDelete(r)} title="Eliminar" className="p-1.5 rounded-full text-zinc-500 hover:bg-rose-100 hover:text-rose-600 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
      </div>
    </>
  );
}