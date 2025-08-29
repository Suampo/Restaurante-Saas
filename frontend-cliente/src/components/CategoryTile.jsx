// src/components/CategoryTile.jsx
export default function CategoryTile({ title, image, onClick, subtitle }) {
  const FALLBACK =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
      <rect width='100%' height='100%' fill='#e5e7eb'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
            font-family='Arial, sans-serif' font-size='16' fill='#6b7280'>Sin imagen</text>
    </svg>`);

  const src = image || FALLBACK;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white text-neutral-900 shadow-sm ring-1 ring-black/5 transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rose-300"
    >
      <div className="relative h-36 w-full overflow-hidden">
        <img
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          onError={(e) => (e.currentTarget.src = FALLBACK)}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        {/* Banda con buen contraste sobre la imagen */}
        <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur px-3 py-2">
          <div className="text-sm font-semibold leading-tight">{title}</div>
          {subtitle ? (
            <div className="text-xs text-neutral-600">{subtitle}</div>
          ) : null}
        </div>
      </div>
    </button>
  );
}
