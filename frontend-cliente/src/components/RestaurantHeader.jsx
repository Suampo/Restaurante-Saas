// src/components/RestaurantHeader.jsx
import React from "react";

/**
 * Componente de esqueleto para el estado de carga del texto
 */
function SkeletonLoader() {
  return (
    <div className="w-full space-y-2 animate-pulse" aria-hidden="true">
      {/* Esqueleto del subtítulo (pequeño) */}
      <div className="h-3 w-32 rounded bg-white/20" />
      {/* Esqueleto del título (grande) */}
      <div className="h-7 w-3/4 rounded bg-white/30" />
    </div>
  );
}

/**
 * Icono de ubicación
 */
function MapPin({ className, ...props }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={className}
      {...props}
    >
      <path d="M12 21s7-4.5 7-11a7 7 0 0 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

/**
 * Cabecera principal para la vista del restaurante
 */
export default function RestaurantHeader({
  name,
  mesaText,
  coverUrl,
  loading = false,
  subtitle = "Servicio a la mesa",
}) {
  return (
    <header className="relative mb-6 w-full overflow-hidden rounded-3xl shadow-xl ring-1 ring-white/10">
      {/* FONDO: Contenedor de imagen y gradiente */}
      <div className="relative h-[140px] w-full bg-[linear-gradient(140deg,#0b1625_0%,#09111f_100%)]">
        {/* Imagen de portada (opcional) */}
        {coverUrl && (
          <img
            src={coverUrl}
            alt="Portada del restaurante"
            className="absolute inset-0 h-full w-full object-cover opacity-30 transition-opacity duration-700"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        {/* Overlay degradado para asegurar legibilidad del texto inferior */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#09111f] via-transparent to-transparent opacity-80" />
      </div>

      {/* CONTENIDO SUPERPUESTO */}
      <div className="absolute inset-0 flex flex-col justify-between p-5 text-white">
        {/* Fila Superior: Badges / Pills */}
        <div className="flex items-start justify-between gap-2">
          {/* Pill de ubicación/servicio */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white shadow-sm ring-1 ring-white/20 backdrop-blur-md">
            <MapPin className="h-3.5 w-3.5 text-white/90" />
            <span className="opacity-90">{subtitle}</span>
          </div>

          {/* Pill de Mesa */}
          <div className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-lg ring-1 ring-emerald-500/50">
            Mesa {mesaText || "—"}
          </div>
        </div>

        {/* Fila Inferior: Títulos */}
        <div className="relative z-10">
          {loading ? (
            <SkeletonLoader />
          ) : (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-xs font-medium tracking-wide text-white/70 uppercase mb-1">
                Menú digital interactivo
              </div>
              <h1 className="text-2xl font-extrabold tracking-tight uppercase text-white drop-shadow-md line-clamp-2 leading-tight">
                {name || "RESTAURANTE"}
              </h1>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}