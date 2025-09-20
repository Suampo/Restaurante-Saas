import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

export function ComboPanel({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    onCreate?.({ nombre: nombre.trim(), precio: Number(precio || 0) });
    setNombre(""); setPrecio("");
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="text-sm font-medium">Combos (Menú del día)</div>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>

      {open && (
        <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[2fr,1fr,auto]">
          <input
            value={nombre}
            onChange={(e)=>setNombre(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Nombre del combo"
          />
          <input
            value={precio}
            onChange={(e)=>setPrecio(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
            placeholder="Precio (S/)"
            inputMode="decimal"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Plus size={16} /> Crear combo
          </button>
        </form>
      )}
    </div>
  );
}
