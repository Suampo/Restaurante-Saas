// src/components/ComboCard.jsx
import React, { useMemo, useState } from "react";

/* Icono flecha */
const ChevronRight = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3" /* Más grueso para que se note mejor */
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/* Resolver imagen desde múltiples campos */
function resolveComboImg(absolute, combo, fallbackImg) {
  const candidates = [
    combo?.cover_url,
    combo?.imagen_url,
    combo?.imagen,
    combo?.image_url,
    combo?.image,
    combo?.foto_url,
    combo?.foto,
  ].filter(Boolean);

  for (const u of candidates) {
    const s = String(u);
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    if (absolute) return absolute(s);
  }
  return fallbackImg || null;
}

export default function ComboCard({
  combo,
  onChoose,
  absolute,
  fallbackImg,
  formatPEN,
}) {
  const title = combo?.nombre || "COMBO";
  const desc = combo?.descripcion || "Ver detalles";

  const imgUrl = useMemo(
    () => resolveComboImg(absolute, combo, fallbackImg),
    [absolute, combo, fallbackImg]
  );

  const price =
    (formatPEN && formatPEN(combo?.precio)) ||
    `S/ ${Number(combo?.precio || 0).toFixed(2)}`;

  const [isImgOk, setIsImgOk] = useState(true);

  return (
    <button
      type="button"
      onClick={onChoose}
      className="
        group relative w-full overflow-hidden rounded-[24px] bg-white text-left
        shadow-md ring-1 ring-black/5
        transition-all duration-300 hover:shadow-xl hover:-translate-y-1
      "
    >
      {/* Contenedor de Imagen Aspecto 3:2 (Estándar para combos) */}
      <div className="relative aspect-[3/2] w-full bg-gray-200">
        {isImgOk && imgUrl ? (
          <img
            src={imgUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading="lazy"
            onError={() => setIsImgOk(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-neutral-400">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Gradiente Oscuro abajo: Crucial para que se lea el texto blanco */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Precio (Arriba derecha, estilo píldora oscura) */}
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur-md shadow-sm border border-white/10">
          {price}
        </div>

        {/* Texto (Abajo izquierda) */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div className="min-w-0 flex-1 pr-2">
            {/* Título en MAYÚSCULAS y negrita */}
            <h3 className="truncate text-base font-bold text-white uppercase tracking-wide drop-shadow-md leading-tight">
              {title}
            </h3>
            {/* Subtítulo pequeño */}
            <p className="mt-0.5 text-xs font-medium text-gray-300 truncate">
              {desc}
            </p>
          </div>
          
          {/* Flecha a la derecha */}
          <ChevronRight
            className="
              mb-1 h-5 w-5 text-white/90 flex-shrink-0
              transition-transform duration-300 group-hover:translate-x-1
            "
          />
        </div>
      </div>
    </button>
  );
}