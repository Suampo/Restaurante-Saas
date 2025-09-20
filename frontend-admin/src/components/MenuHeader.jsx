// src/components/MenuHeader.jsx
import { Search, Plus } from "lucide-react";

export function MenuHeader({ q, query, setQ, setQuery, onNew, onCreate }) {
  const value = q ?? query ?? "";
  const setValue = setQ ?? setQuery ?? (() => {});
  const handleNew = onNew || onCreate;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Menú</h1>
        <p className="text-sm text-slate-500">Administra tus platos e imágenes.</p>
      </div>

      <div className="flex w-full items-center gap-2 sm:w-auto">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Buscar plato…"
          />
        </div>
        <button
          onClick={handleNew}
          className="hidden items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 sm:inline-flex"
        >
          <Plus size={16} />
          Nuevo plato
        </button>
      </div>
    </div>
  );
}
