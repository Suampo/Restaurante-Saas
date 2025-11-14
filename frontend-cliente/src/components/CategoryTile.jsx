// src/components/CategoryTile.jsx
import React, { memo, useMemo, useState, useId } from "react";

/**
 * Props:
 * - title, subtitle, image, fallback, onClick
 * - variant: "landscape" | "square"
 * - badge?: string, count?: number, disabled?: boolean
 * - align?: "left" | "center"
 * - showChevron?: boolean
 * - optimizeImages?: boolean (default true)
 * - priority?: boolean (si true → fetchpriority="high")
 */
function CategoryTile({
  title,
  subtitle,
  image,
  fallback,
  onClick,
  variant = "landscape",
  badge,
  count,
  disabled = false,
  align = "left",
  showChevron = true,
  optimizeImages = true,
  priority = false,
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const API_BASE =
    import.meta.env.VITE_API_PEDIDOS ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  const isAbs = (u = "") =>
    /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");
  const toAbs = (u = "") =>
    isAbs(u) ? u : `${API_BASE}${u?.startsWith("/") ? "" : "/"}${u || ""}`;

  // ¿Conviene proxear esta URL?
  const shouldProxy = (u = "") =>
    /^https?:\/\//i.test(u) && !u.includes("/img?"); // solo http(s) y sin doble proxy

  // Genera URL del proxy /img
  const imgFit = (url, w, q = 70, fmt = "webp") => {
    const abs = toAbs(url);
    if (!shouldProxy(abs)) return abs; // data:, blob:, etc → no proxear
    const u = new URL(`${API_BASE}/img`);
    u.searchParams.set("url", abs);
    u.searchParams.set("width", String(w));
    u.searchParams.set("q", String(q));
    u.searchParams.set("fmt", fmt);
    return u.toString();
  };

  const original = useMemo(
    () => (failed ? fallback : image || fallback),
    [image, fallback, failed]
  );

  const widths = variant === "square" ? [160, 200, 240, 320] : [192, 216, 240, 320, 384];
  const sizes  =
    variant === "square"
      ? "(max-width: 480px) 160px, (max-width: 640px) 200px, (max-width: 768px) 240px, 320px"
      : "(max-width: 480px) 192px, (max-width: 640px) 216px, (max-width: 768px) 240px, 320px";

  // reservar espacio (reduce CLS)
  const logicalW = 240;
  const logicalH = variant === "square" ? 240 : 180; // 4:3

  const useProxy = optimizeImages && shouldProxy(original);
  const src = useMemo(
    () => (useProxy ? imgFit(original, logicalW) : toAbs(original)),
    [original, useProxy]
  );
  const srcSet = useMemo(() => {
    if (!useProxy) return undefined;
    return widths.map((w) => `${imgFit(original, w)} ${w}w`).join(", ");
  }, [original, useProxy]);

  const alt = title || "Imagen";
  const ratio = variant === "square" ? "aspect-square" : "aspect-[4/3]";
  const titleId = useId();
  const subId = useId();

  const handleKey = (e) => {
    if (disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  const alignBox   = align === "center" ? "items-center text-center" : "items-start text-left";
  const titleClamp = align === "center" ? "" : "line-clamp-1";
  const subClamp   = align === "center" ? "hidden sm:block line-clamp-1 mt-0.5" : "line-clamp-1";

  // 👇 React no reconoce fetchPriority en camelCase. Usar minúsculas o no pasarlo.
  const priorityAttrs = priority ? { fetchpriority: "high" } : {};

  return (
    <div
      className={[
        "group relative w-full overflow-hidden rounded-2xl ring-1 ring-black/5",
        "bg-white/85 backdrop-blur shadow-sm transition",
        disabled
          ? "opacity-60 grayscale"
          : "hover:-translate-y-[1px] hover:shadow-lg focus-within:ring-2 focus-within:ring-emerald-400/60",
      ].join(" ")}
    >
      {/* Media con proporción fija + zoom */}
      <div className={`relative ${ratio} w-full overflow-hidden hover-zoom`}>
        {/* Skeleton */}
        <div
          className={[
            "absolute inset-0 transition-opacity duration-300",
            loaded ? "opacity-0" : "opacity-100",
            "animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200",
          ].join(" ")}
        />

        {src ? (
          <img
            src={src}
            srcSet={srcSet}
            sizes={srcSet ? sizes : undefined}
            width={logicalW}
            height={logicalH}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...priorityAttrs}
            className={[
              "absolute inset-0 h-full w-full object-cover hover-zoom-img",
              "transition duration-500 ease-out",
              loaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-[1.02] blur-sm",
            ].join(" ")}
            onLoad={() => setLoaded(true)}
            onError={() => {
              setFailed(true);
              setLoaded(true);
            }}
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-neutral-100 text-neutral-400 text-sm">
            Sin imagen
          </div>
        )}

        {/* Degradado + borde */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />

        {badge && (
          <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-neutral-900 shadow">
            {badge}
          </div>
        )}
        {typeof count === "number" && (
          <div className="absolute right-2 top-2 grid h-7 min-w-[28px] place-items-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white shadow">
            {count > 99 ? "99+" : count}
          </div>
        )}
      </div>

      {/* Body */}
      <button
        type="button"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subId : undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={onClick}
        onKeyDown={handleKey}
        className={[
          "flex w-full gap-2 p-3 text-[15px] outline-none",
          alignBox,
          disabled ? "cursor-not-allowed" : "cursor-pointer",
          "min-h-[58px]",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div id={titleId} className={`${titleClamp} font-semibold text-neutral-900`}>
            {title}
          </div>
          {subtitle ? (
            <div id={subId} className={`${subClamp} text-xs text-neutral-500`}>
              {subtitle}
            </div>
          ) : null}
        </div>

        {showChevron && (
          <ChevronRight
            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-neutral-600"
            aria-hidden="true"
          />
        )}
      </button>
    </div>
  );
}

function ChevronRight(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default memo(CategoryTile);
