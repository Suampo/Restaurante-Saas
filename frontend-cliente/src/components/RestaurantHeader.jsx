export default function RestaurantHeader({
  name,
  mesaText,
  coverUrl,
  loading = false,
  subtitle = "Servicio a la mesa",
}) {
  return (
    <header
      className="relative mb-5 overflow-hidden rounded-2xl shadow-md ring-1 ring-black/10 animate-fadeInUp lg:mb-4"
      aria-busy={loading ? "true" : "false"}
    >
      {/* tarjeta oscura */}
      <div className="relative h-28 w-full select-none sm:h-32">
        <div className="absolute inset-0 bg-slate-900" />
        {coverUrl && (
          <img
            src={coverUrl}
            alt={name || "Restaurante"}
            className="absolute inset-0 h-full w-full object-cover opacity-45"
            loading="lazy"
            decoding="async"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />
      </div>

      {/* contenido */}
      <div className="absolute inset-0 flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 text-white">
          {loading ? (
            <>
              <div className="h-4 w-36 rounded bg-white/30 animate-pulse" />
              <div className="mt-2 h-6 w-56 rounded bg-white/40 animate-pulse" />
            </>
          ) : (
            <>
              <h1 className="text-xl font-extrabold leading-tight uppercase drop-shadow-sm">
                {name || "RESTAURANTE"}
              </h1>
              <div className="mt-1 flex items-center gap-1 text-[13px] text-white/85">
                <MapPin className="h-4 w-4 text-white/80" />
                {subtitle}
              </div>
            </>
          )}
        </div>

        {/* pill de mesa */}
        <div className="shrink-0 rounded-full bg-white/12 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25 backdrop-blur">
          Mesa {mesaText || "—"}
        </div>
      </div>
    </header>
  );
}

function MapPin(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M12 21s7-4.5 7-11a7 7 0 0 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}
