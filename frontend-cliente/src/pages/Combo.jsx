import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../App";

export default function Combo() {
  const nav = useNavigate();
  const { combos, categories } = useMenuPublic();
  const combo = combos[0]; // si tienes varios, podrías listarlos

  const entradas = useMemo(() => categories.find(c => c.nombre?.toLowerCase() === "entrada")?.items || [], [categories]);
  const fondos   = useMemo(() => categories.find(c => c.nombre?.toLowerCase() === "fondo")?.items   || [], [categories]);

  const [entrada, setEntrada] = useState(null);
  const [fondo, setFondo] = useState(null);

  const addCombo = () => {
    if (!entrada || !fondo) return alert("Elige una entrada y un fondo");
    window.dispatchEvent(new CustomEvent("cart:add", {
      detail: { item: { isCombo: true, comboId: combo.id, nombreCombo: combo.nombre, precio: combo.precio, entrada, plato: fondo, cantidad: 1 } }
    }));
    nav(-1);
  };

  const Tile = ({data, active, onClick}) => (
   <button
     onClick={onClick}
     className={`rounded-xl border p-2 text-left bg-white text-neutral-900 hover:bg-neutral-50 ${
       active ? "ring-2 ring-emerald-500" : "border-neutral-200"
     }`}
   >
      <img src={absolute(data.imagen_url) || FALLBACK_IMG} onError={(e)=>{e.currentTarget.src=FALLBACK_IMG}} className="h-28 w-full object-cover rounded-lg" />
      <div className="mt-1 font-medium">{data.nombre}</div>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <button onClick={() => nav(-1)} className="mb-3 text-sm text-neutral-900 hover:underline">← Volver</button>
      <h1 className="mb-1 text-xl text-neutral-900">{combo?.nombre || "Menú del día"}</h1>
      <p className="text-neutral-900 hover:underline">Elige 1 entrada + 1 fondo — {formatPEN(combo?.precio || 0)}</p>

      <h3 className="mt-4 mb-2 text-neutral-900">Entradas</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {entradas.map(e => <Tile key={e.id} data={e} active={entrada?.id===e.id} onClick={()=>setEntrada(e)} />)}
      </div>

      <h3 className="mt-6 mb-2 text-neutral-900">Fondos</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {fondos.map(f => <Tile key={f.id} data={f} active={fondo?.id===f.id} onClick={()=>setFondo(f)} />)}
      </div>

      <div className="mt-6">
        <button onClick={addCombo} className="rounded-xl bg-emerald-600 px-5 py-2 text-white hover:bg-emerald-500">Agregar combo al carrito</button>
      </div>
    </div>
  );
}
