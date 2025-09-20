import { Filter, ChevronDown, Plus } from "lucide-react";

export function CategoryRail({
  categorias = [],
  catSel, setCatSel,
  show, setShow,
  sort, setSort,
  onNewCategory,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Chips scrollables */}
      <div className="relative -mx-2 w-full overflow-x-auto px-2">
        <div className="flex min-w-max items-center gap-2 pb-1">
          <Chip active={catSel == null} onClick={() => setCatSel(null)}>Todas</Chip>
          {categorias.map(c => (
            <Chip key={c.id} active={catSel === c.id} onClick={() => setCatSel(c.id)}>{c.nombre}</Chip>
          ))}
          <button
            onClick={onNewCategory}
            className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50"
          >
            <Plus size={14} /> Nueva categoría
          </button>
        </div>
      </div>

      {/* Filtros secundarios */}
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden text-xs text-slate-500 sm:flex sm:items-center sm:gap-1">
          <Filter size={14} /> Filtros
        </div>

        <select
          value={show}
          onChange={(e)=>setShow(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          title="Visibilidad"
        >
          <option value="all">Todos</option>
          <option value="visible">Visibles</option>
          <option value="hidden">Ocultos</option>
          <option value="noimg">Sin imagen</option>
        </select>

        <div className="relative">
          <select
            value={sort}
            onChange={(e)=>setSort(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm"
            title="Ordenar por"
          >
            <option value="alpha">A–Z</option>
            <option value="newest">Más nuevos</option>
            <option value="price">Precio</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
    </div>
  );
}

function Chip({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition ${
        active
          ? "border border-green-300 bg-green-50 text-green-800"
          : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
