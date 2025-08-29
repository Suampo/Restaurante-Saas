import { memo } from "react";

function ProductCard({ item, onAdd, absolute, fallbackImg, formatPEN }) {
  const price = formatPEN(item.precio);
  const src = absolute(item.imagen_url) || fallbackImg;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-sm ring-1 ring-black/5">
      {/* Imagen a full + badge de precio arriba a la izquierda */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-2xl">
        <img
          src={src}
          alt={item.nombre}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = fallbackImg;
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <span className="absolute left-2 top-2 sm:left-3 sm:top-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-white backdrop-blur">
          {price}
        </span>
      </div>

      {/* Contenido */}
      <div className="flex flex-col flex-1 min-w-0 p-3 sm:p-4">
        {/* Título más pequeño */}
        <h3 className="line-clamp-2 text-[13px] md:text-sm font-semibold tracking-tight">
          {item.nombre}
        </h3>

        <p className="mt-1 line-clamp-2 text-xs sm:text-sm text-neutral-600">
          {item.descripcion || ""}
        </p>

        {/* Botón Agregar (sin precio a la derecha) */}
        <div className="mt-auto">
          <button
            onClick={() => onAdd?.(item)}
            className="h-10 w-full rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white transition hover:bg-emerald-700 active:translate-y-[1px]"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(ProductCard);
