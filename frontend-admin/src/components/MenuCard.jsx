// src/components/MenuCard.jsx
import React from 'react';
import { Eye, EyeOff, Pencil, Trash2, Tag } from 'lucide-react'; // <-- Íconos de Lucide

const FALLBACK = "/no-image.png";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

// Helper para asegurar que la URL de la imagen sea absoluta
const toAbs = (u) => (u?.startsWith("http") ? u : u ? `${API_BASE}${u}` : "");

export default function MenuCard({
  item,
  onEdit,
  onDelete,
  onToggleActive,
  categoryName,
}) {
  const src = toAbs(item.imagen_url) || FALLBACK;
  const isInactive = item.activo === false;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white/70 shadow-lg shadow-zinc-200/50 backdrop-blur-lg ring-1 ring-black/5 transition-shadow duration-300 hover:shadow-xl">
      
      {/* --- Contenedor de Imagen --- */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={src}
          onError={(e) => { e.currentTarget.src = FALLBACK; }}
          alt={item.nombre}
          className={`h-full w-full object-cover transition-transform duration-300 ease-in-out group-hover:scale-105 ${isInactive ? 'grayscale' : ''}`}
          loading="lazy"
        />
        {isInactive && (
            <>
                <div className="absolute inset-0 bg-white/60" />
                <div className="absolute top-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-800 px-2 py-1 text-xs font-semibold text-white">
                    <EyeOff size={14} /> Oculto
                </div>
            </>
        )}
      </div>

      {/* --- Contenedor de Texto --- */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex-grow">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-zinc-800">
              {item.nombre || "Sin nombre"}
            </h3>
            {categoryName && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-inset ring-zinc-200">
                <Tag size={12} /> {categoryName}
              </span>
            )}
          </div>
          
          <p className="mt-2 line-clamp-2 text-sm text-zinc-600">
            {item.descripcion || ""}
          </p>
        </div>
        
        {/* --- Precio y Acciones --- */}
        <div className="mt-4 flex items-end justify-between">
          <p className="text-xl font-bold text-green-700">
            S/ {Number(item.precio || 0).toFixed(2)}
          </p>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => onToggleActive(item)}
              title={isInactive ? "Mostrar en menú" : "Ocultar del menú"}
              className={`p-2 rounded-full transition-colors ${isInactive ? 'text-zinc-500 hover:bg-zinc-200' : 'text-green-600 hover:bg-green-100' }`}
            >
              {isInactive ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
            <button
              onClick={() => onEdit(item)}
              title="Editar plato"
              className="p-2 rounded-full text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-800"
            >
              <Pencil className="h-5 w-5" />
            </button>
            <button
              onClick={() => onDelete(item.id)}
              title="Eliminar plato"
              className="p-2 rounded-full text-zinc-500 transition-colors hover:bg-rose-100 hover:text-rose-600"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}