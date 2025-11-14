import React, { useMemo, useState } from "react";

/* Icono flecha */
const ChevronRight = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" {...p}>
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
  const title = combo?.nombre || "MENÚ";
  const imgUrl = useMemo(() => resolveComboImg(absolute, combo, fallbackImg), [absolute, combo, fallbackImg]);

  const price =
    (formatPEN && formatPEN(combo?.precio)) ||
    `S/ ${Number(combo?.precio || 0).toFixed(2)}`;

  const [isImgOk, setIsImgOk] = useState(true);
  const badge = combo?.badge || combo?.popular ? "Popular" : null;

  return (
    <button
      type="button"
      onClick={onChoose}
      className="group w-full overflow-hidden rounded-2xl bg-white text-left shadow-card ring-1 ring-black/5 transition hover:-translate-y-px"
    >
      {/* Imagen 16:9 */}
      <div className="relative aspect-[16/9] w-full">
        {isImgOk && imgUrl ? (
          <img
            src={imgUrl}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setIsImgOk(false)}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-sky-500" />
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-black/5 to-transparent" />

        {/* badge Popular */}
        {badge && (
          <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-1 text-[11px] font-semibold text-zinc-900 shadow">
            {badge}
          </span>
        )}

        {/* precio “glass” */}
        <div className="absolute right-2 top-2 rounded-full bg-black/35 px-3 py-1 text-[13px] font-bold text-white backdrop-blur-sm ring-1 ring-white/20">
          {price}
        </div>
      </div>

      {/* Texto */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3 p-4">
        <div>
          <div className="line-clamp-1 text-base font-bold text-neutral-800">{title}</div>
          <div className="text-sm text-neutral-500">Ver detalles</div>
        </div>
        <ChevronRight className="h-5 w-5 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
      </div>
    </button>
  );
}
