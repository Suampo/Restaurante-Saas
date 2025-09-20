import { useState } from "react";
import { Eye, EyeOff, Pencil, Trash2, Star, Layers } from "lucide-react";

const PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });

export function DishCard({ dish, onToggleVisible, onDelete, onEdit, onPriceSave }) {
  const [editingPrice, setEditingPrice] = useState(false);
  const [price, setPrice] = useState(dish.precio ?? 0);

  const savePrice = async () => {
    const n = Number(price || 0);
    await onPriceSave?.(dish.id, n);
    setEditingPrice(false);
  };

  return (
    <div className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      {/* Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {dish.imagen_url ? (
          <img src={dish.imagen_url} alt={dish.nombre} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-slate-400">Sin imagen</div>
        )}

        {/* Badges */}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {!dish.visible && (
            <span className="rounded-md bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-medium text-white">Oculto</span>
          )}
          {dish.destacado && (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <Star size={10}/> Destacado
            </span>
          )}
          {dish.en_combo && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
              <Layers size={10}/> En combo
            </span>
          )}
        </div>

        {/* Precio */}
        <div className="absolute right-2 top-2 rounded-full bg-white/95 px-2 py-1 text-xs font-semibold shadow">
          {PEN.format(Number(dish.precio || 0))}
        </div>
      </div>

      {/* Contenido */}
      <div className="p-3">
        <div className="mb-1 line-clamp-1 font-medium">{dish.nombre}</div>
        <div className="line-clamp-2 text-xs text-slate-500">{dish.desc || "Sin descripción"}</div>

        {/* Acciones */}
        <div className="mt-3 flex items-center justify-between">
          {/* Precio editable rápido */}
          <div className="flex items-center gap-2">
            {editingPrice ? (
              <>
                <input
                  value={price}
                  onChange={(e)=>setPrice(e.target.value)}
                  onKeyDown={(e)=>e.key==="Enter" && savePrice()}
                  className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-xs focus:border-green-500 focus:ring-2 focus:ring-green-500/30"
                />
                <button onClick={savePrice} className="rounded-lg bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700">
                  Guardar
                </button>
              </>
            ) : (
              <button
                onClick={()=>setEditingPrice(true)}
                className="text-xs text-slate-600 underline underline-offset-2 hover:text-slate-800"
                title="Editar precio rápido"
              >
                Editar precio
              </button>
            )}
          </div>

          {/* Botonera hover */}
          <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
            <button
              onClick={() => onToggleVisible?.(dish.id, !dish.visible)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              title={dish.visible ? "Ocultar" : "Mostrar"}
            >
              {dish.visible ? <EyeOff size={14}/> : <Eye size={14}/>}
            </button>
            <button
              onClick={onEdit}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs hover:bg-slate-50"
              title="Editar"
            >
              <Pencil size={14}/>
            </button>
            <button
              onClick={() => onDelete?.(dish.id)}
              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700 hover:bg-rose-100"
              title="Eliminar"
            >
              <Trash2 size={14}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
