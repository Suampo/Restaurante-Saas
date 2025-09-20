export default function RestaurantHeader({
  name,
  mesaText,
  coverUrl,
  loading = false,
}) {
  return (
    <header
      className="relative mb-5 lg:mb-4 overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 animate-fadeInUp"
      aria-busy={loading ? "true" : "false"}
    >
      {/* Imagen o fondo */}
      <div className="relative h-24 w-full select-none sm:h-28 md:h-28 lg:h-22">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name || "Restaurante"}
            className="absolute inset-0 h-full w-full object-cover pointer-events-none transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 pointer-events-none" />
        )}

        {/* Overlay con degradado */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent pointer-events-none" />
      </div>

      {/* Contenido */}
      <div className="absolute inset-0 p-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-100/90">
            Restaurante
          </div>

          {loading ? (
            <div className="mt-1 h-5 w-48 rounded bg-white/40 animate-pulse" />
          ) : (
            <h1 className="mt-0.5 text-xl font-extrabold leading-tight text-white drop-shadow">
              {name || "—"}
            </h1>
          )}
        </div>

        {/* Badge de mesa */}
        <div className="shrink-0 rounded-xl bg-emerald-600/95 px-3 py-2 text-right shadow-md ring-1 ring-black/10 backdrop-blur-sm lg:py-1.5">
          <div className="text-[11px] leading-none text-emerald-100/90">
            Mesa
          </div>
          <div className="text-sm font-bold text-white">{mesaText || "—"}</div>
        </div>
      </div>
    </header>
  );
}