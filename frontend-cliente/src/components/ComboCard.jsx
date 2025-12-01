// src/components/ComboCard.jsx
import React, { useMemo, useState } from "react";

/* Config para optimizar imágenes (igual estilo que CategoryTile) */
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const isAbs = (u = "") =>
  /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");

const toAbs = (u = "") =>
  isAbs(u) ? u : `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;

const shouldProxy = (u = "") =>
  /^https?:\/\//i.test(u) && !u.includes("/img?");

const imgFit = (url, w, q = 70, fmt = "webp") => {
  const abs = toAbs(url);
  if (!shouldProxy(abs)) return abs;
  const u = new URL(`${API_BASE}/img`);
  u.searchParams.set("url", abs);
  u.searchParams.set("width", String(w));
  u.searchParams.set("q", String(q));
  u.searchParams.set("fmt", fmt);
  return u.toString();
};

/* Icono flecha */
const ChevronRight = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
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
    // Si es URL absoluta (Supabase, etc.), la usamos tal cual
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    // Si es relativa y nos pasan un "absolute", lo usamos
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
  optimizeImages = true,
  priority = false,
}) {
  const title = combo?.nombre || "COMBO";
  const desc = combo?.descripcion || "Ver detalles";

  // URL base (original: Supabase o lo que venga)
  const baseImgUrl = useMemo(
    () => resolveComboImg(absolute, combo, fallbackImg),
    [absolute, combo, fallbackImg]
  );

  const [isImgOk, setIsImgOk] = useState(true);

  const price =
    (formatPEN && formatPEN(combo?.precio)) ||
    `S/ ${Number(combo?.precio || 0).toFixed(2)}`;

  // Responsivo: tamaños para la card (aspect 3:2)
  const logicalW = 480;
  const logicalH = Math.round((logicalW * 2) / 3);
  const widths = [240, 320, 480, 640];
  const sizes =
    "(max-width: 640px) 100vw, (max-width: 1024px) 480px, 640px";

  const useProxy = baseImgUrl && optimizeImages && shouldProxy(baseImgUrl);

  const src = useMemo(() => {
    if (!baseImgUrl) return null;
    if (!useProxy) return baseImgUrl;
    // pedimos una versión ajustada a 480px de ancho
    return imgFit(baseImgUrl, logicalW);
  }, [baseImgUrl, useProxy]);

  const srcSet = useMemo(() => {
    if (!baseImgUrl || !useProxy) return undefined;
    return widths.map((w) => `${imgFit(baseImgUrl, w)} ${w}w`).join(", ");
  }, [baseImgUrl, useProxy]);

  const finalSrc = src || baseImgUrl || null;

  // 👇 aquí usamos el atributo correcto en minúsculas
  const priorityAttrs = priority ? { fetchpriority: "high" } : {};

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
        {isImgOk && finalSrc ? (
          <img
            src={finalSrc}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            width={logicalW}
            height={logicalH}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...priorityAttrs}
            onError={() => setIsImgOk(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 text-neutral-400">
            <svg
              className="w-10 h-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Gradiente Oscuro abajo */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Precio (Arriba derecha) */}
        <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur-md shadow-sm border border-white/10">
          {price}
        </div>

        {/* Texto (Abajo izquierda) */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
          <div className="min-w-0 flex-1 pr-2">
            <h3 className="truncate text-base font-bold text-white uppercase tracking-wide drop-shadow-md leading-tight">
              {title}
            </h3>
            <p className="mt-0.5 text-xs font-medium text-gray-300 truncate">
              {desc}
            </p>
          </div>

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
