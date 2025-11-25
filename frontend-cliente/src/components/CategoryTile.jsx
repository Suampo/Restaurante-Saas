// src/components/CategoryTile.jsx
import React, { memo, useMemo, useState, useId } from "react";

function CategoryTile({
  title,
  subtitle,
  image,
  fallback,
  onClick,
  variant = "landscape", // "square" o "landscape"
  badge,
  count,
  disabled = false,
  showChevron = true,
  optimizeImages = true,
  priority = false,
  className = "",
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

  const original = useMemo(
    () => (failed ? fallback : image || fallback),
    [image, fallback, failed]
  );

  const widths =
    variant === "square" ? [160, 200, 240, 320] : [192, 216, 240, 320, 384];

  const sizes =
    variant === "square"
      ? "(max-width: 480px) 160px, (max-width: 640px) 200px, (max-width: 768px) 240px, 320px"
      : "(max-width: 480px) 192px, (max-width: 640px) 216px, (max-width: 768px) 240px, 320px";

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

  const priorityAttrs = priority ? { fetchpriority: "high" } : {};

  const disabledClasses = disabled
    ? "opacity-60 grayscale cursor-not-allowed"
    : "cursor-pointer";

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-labelledby={titleId}
      aria-describedby={subtitle ? subId : undefined}
      className={[
        "group relative w-full overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5",
        "transition-transform duration-200 hover:-translate-y-[1px] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/70",
        disabledClasses,
        className,
      ].join(" ")}
    >
      <div className={`relative ${ratio} w-full`}>
        {/* Skeleton mientras carga */}
        <div
          className={[
            "absolute inset-0 transition-opacity duration-300",
            loaded ? "opacity-0" : "opacity-100",
            "animate-pulse bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200",
          ].join(" ")}
        />

        {/* Imagen */}
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
              "absolute inset-0 h-full w-full object-cover",
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

        {/* Degradado oscuro inferior (texto sobre foto) */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />

        {/* Borde suave */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-black/5" />

        {/* Badge opcional arriba a la izquierda */}
        {badge && (
          <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-neutral-900 shadow">
            {badge}
          </div>
        )}

        {/* Contador opcional arriba a la derecha */}
        {typeof count === "number" && (
          <div className="absolute right-2 top-2 grid h-7 min-w-[28px] place-items-center rounded-full bg-emerald-600 px-1 text-[11px] font-semibold text-white shadow">
            {count > 99 ? "99+" : count}
          </div>
        )}

        {/* Texto + chevron abajo, sobre la imagen */}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-2 pt-3">
          <div className="min-w-0">
            <div
              id={titleId}
              className="line-clamp-1 text-[13px] font-semibold leading-tight text-white"
            >
              {title}
            </div>
            {subtitle && (
              <div
                id={subId}
                className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-white/85"
              >
                {subtitle}
              </div>
            )}
          </div>

          {showChevron && (
            <div className="ml-2 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/95 text-neutral-800 shadow-md">
              <ChevronRight className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ChevronRight(props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      {...props}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default memo(CategoryTile);
