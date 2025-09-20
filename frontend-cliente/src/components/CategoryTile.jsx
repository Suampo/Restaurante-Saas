// src/components/CategoryTile.jsx
import React, { memo } from "react";

function CategoryTile({ title, subtitle, image, onClick, fallback }) {
  const alt = title || "Imagen";

  return (
    <button
      type="button"
      aria-label={title}
      onClick={onClick}
      className="group will-change-transform overflow-hidden rounded-2xl border border-neutral-200 bg-white text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-lg touch-manipulation active:scale-[.99]"
    >
      {/* Mantener proporción evita saltos mientras carga la imagen */}
      <div className="relative aspect-[4/3] w-full">
        <img
          src={image || fallback}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          fetchpriority="low"            // 👈 en minúsculas (ya no mostrará el warning)
          sizes="(min-width:1024px) 256px, (min-width:768px) 33vw, 50vw"
          draggable={false}
          onError={(e) => {
            if (fallback && e.currentTarget.src !== fallback) {
              e.currentTarget.src = fallback;
            }
          }}
        />
        {/* Degradado sutil al hover (mejor contraste) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <div className="space-y-0.5 p-3">
        <div className="line-clamp-1 text-[15px] font-semibold text-neutral-900">
          {title}
        </div>
        {subtitle ? (
          <div className="line-clamp-1 text-xs text-neutral-500">{subtitle}</div>
        ) : null}
      </div>
    </button>
  );
}

export default memo(CategoryTile);
