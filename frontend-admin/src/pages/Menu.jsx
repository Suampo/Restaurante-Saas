// src/pages/Menu.jsx
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";

import { MenuHeader } from "../components/MenuHeader";
import MenuCard from "../components/MenuCard";
import MenuItemEdit from "../components/MenuItemEdit";
import CategoriesManager from "../components/CategoriesManager";
import ComboManager from "../components/ComboManager";
import useMenuItems from "../hooks/useMenuItems";
import { getCategories } from "../services/categoriesApi";

export default function Menu() {
  const {
    pageItems, query, setQuery, loading,
    editing, creating, openCreate, openEdit, closeModal,
    saveItem, deleteItem, filtered, toggleActive,
    limit, setLimit, page, setPage,
  } = useMenuItems();

  const [categories, setCategories] = useState([]);

  // Cargar categorías una vez
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const c = await getCategories();
        if (!alive) return;
        setCategories(Array.isArray(c) ? c : []);
      } catch (e) {
        console.error("categories:", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // id -> nombre para chips del grid
  const catNameById = useMemo(
    () => Object.fromEntries((categories || []).map((c) => [c.id, c.nombre])),
    [categories]
  );

  // métricas
  const total = filtered?.length || 0;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit || 1)));
  const visibles = useMemo(
    () => (filtered || []).filter((it) => (it.activo ?? it.visible ?? true)).length,
    [filtered]
  );

  // mantener página válida
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p || 1), totalPages));
  }, [totalPages, setPage]);

  const goPrev = () => setPage((p) => Math.max(1, (p || 1) - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, (p || 1) + 1));

  // ---------- NOTIFICADOR → para refrescar Dashboard ----------
  const notifyMenuChanged = () => {
    try { window.dispatchEvent(new Event("menu:changed")); } catch {}
  };

  const handleSave = async (payload) => {
    await saveItem(payload);
    notifyMenuChanged();
  };

  const handleDelete = async (id) => {
    await deleteItem(id);
    notifyMenuChanged();
  };

  const handleToggle = async (id, next) => {
    await toggleActive(id, next);
    notifyMenuChanged();
  };
  // -----------------------------------------------------------

  // exportar CSV (filtrados)
  const exportCSV = () => {
    const headers = ["id","nombre","descripcion","precio","visible","categoria"];
    const rows = (filtered || []).map((it) => {
      const catId = it.categoria_id ?? it.categoriaId;
      const cat = catNameById[catId] || "";
      return [
        it.id,
        escCSV(it.nombre ?? ""),
        escCSV(it.descripcion ?? it.desc ?? ""),
        Number(it.precio ?? 0).toFixed(2),
        (it.activo ?? it.visible ?? true) ? "sí" : "no",
        escCSV(cat),
      ].join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "menu_export.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-6">
      <div className="mx-auto w-full max-w-7xl px-4">
        {/* Header */}
        <div className="mb-3">
          <MenuHeader query={query} setQuery={setQuery} onNew={openCreate} />
          <div className="mt-1 text-sm text-slate-600">
            <strong>{total}</strong> platos <span className="mx-1">•</span>{" "}
            <strong>{visibles}</strong> visibles
          </div>
        </div>

        {/* Gestores */}
        <div className="mb-6">
          <CategoriesManager onChange={setCategories} />
        </div>

        <div className="mb-6">
          <ComboManager cats={categories} />
        </div>

        {/* 👇 Barra de paginación y export justo encima del GRID */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="text-sm text-slate-600">
            Página <strong>{page || 1}</strong> de {totalPages}
          </div>

          <div className="ml-auto inline-flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm">
              <span className="hidden sm:inline text-slate-600">Mostrar</span>
              <label htmlFor="perpage" className="sr-only">
                Items por página
              </label>
              <select
                id="perpage"
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-sm"
              >
                {/* 👇 añadí 4 por página */}
                {[4, 8, 12, 16, 24, 32, 48].map((n) => (
                  <option key={n} value={n}>
                    {n} / pág.
                  </option>
                ))}
              </select>

              <button
                onClick={goPrev}
                className="rounded-md border border-slate-200 bg-white p-2 sm:p-1 hover:bg-slate-50"
                title="Anterior"
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="min-w-[88px] text-center text-slate-700">
                Pág. <strong>{page || 1}</strong> / {totalPages}
              </div>
              <button
                onClick={goNext}
                className="rounded-md border border-slate-200 bg-white p-2 sm:p-1 hover:bg-slate-50"
                title="Siguiente"
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 sm:px-3 sm:py-2 text-sm hover:bg-slate-50"
              title="Exportar CSV"
              aria-label="Exportar CSV"
            >
              <Download size={16} />
              <span className="hidden sm:inline">Exportar</span>
            </button>
          </div>
        </div>

        {/* GRID */}
        {loading ? (
          <GridSkeleton />
        ) : pageItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-10 text-center text-neutral-600">
            No hay platos que coincidan.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pageItems.map((it) => {
              const catId = it.categoria_id ?? it.categoriaId;
              return (
                <MenuCard
                  key={it.id}
                  item={it}
                  categoryName={catNameById[catId] || "Sin categoría"}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onToggleActive={handleToggle}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* CTA flotante móvil */}
      <button
        className="fixed bottom-6 right-6 inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-green-700 md:hidden"
        onClick={openCreate}
      >
        <Plus size={18} /> Nuevo plato
      </button>

        {/* Modal: Crear / Editar plato (responsive) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl bg-white ring-1 ring-black/5">
            <div className="border-b p-4">
              <h3 className="text-lg font-semibold">
                {creating ? "Crear plato" : "Editar plato"}
              </h3>
            </div>

            <div className="p-4">
              <MenuItemEdit
                item={editing}
                onSave={handleSave}
                categorias={categories}
              />
            </div>

            <div className="flex justify-end gap-2 border-t p-3">
              <button
                className="rounded-lg px-4 py-2 text-sm hover:bg-neutral-100"
                onClick={closeModal}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-2xl bg-white shadow ring-1 ring-black/5"
        >
          <div className="h-52 bg-neutral-200" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 bg-neutral-200" />
            <div className="h-3 w-full bg-neutral-200" />
            <div className="h-3 w-5/6 bg-neutral-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

function escCSV(s) {
  const t = String(s ?? "");
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}
