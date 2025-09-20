import { useState } from "react";
import { Search, Plus } from "lucide-react";

export default function MesasHeader({ onAdd, adding, query, setQuery }) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    const cod = codigo.trim();
    if (!cod) return alert("Ingresa un código para la mesa");
    await onAdd({ codigo: cod, descripcion: descripcion.trim() });
    setCodigo("");
    setDescripcion("");
  };

  return (
    <>
      {/* Título + búsqueda */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Mesas</h2>
          <p className="text-sm text-slate-500">Crea, busca y administra tus mesas.</p>
        </div>

        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-lg border border-slate-300 bg-white px-9 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Buscar por código o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Form crear mesa */}
      <form
        onSubmit={submit}
        className="mb-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 sm:grid-cols-[1fr,2fr,auto]">
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Código (ej: MESA-1)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
          />
          <input
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            {adding ? "Agregando..." : "Agregar mesa"}
          </button>
        </div>
      </form>
    </>
  );
}
