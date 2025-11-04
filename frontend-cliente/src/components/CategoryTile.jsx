import React, { memo, useMemo, useState, useId } from "react";

/**
 * CategoryTile
 * Props:
 * - title, subtitle, image, fallback, onClick
 * - variant: "landscape" | "square"
 * - badge?: string, count?: number, disabled?: boolean
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
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const alt = title || "Imagen";
  const src = useMemo(() => (!failed ? image || fallback : fallback), [image, fallback, failed]);
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
            alt={alt}
            loading="lazy"
            decoding="async"
            className={[
              "absolute inset-0 h-full w-full object-cover hover-zoom-img",
              "transition duration-500 ease-out",
              loaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-[1.02] blur-sm",
            ].join(" ")}
            onLoad={() => setLoaded(true)}
            onError={() => { setFailed(true); setLoaded(true); }}
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
        className={["flex w-full items-start gap-2 p-3 text-left outline-none", disabled ? "cursor-not-allowed" : "cursor-pointer"].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <div id={titleId} className="line-clamp-1 text-[15px] font-semibold text-neutral-900">
            {title}
          </div>
          {subtitle ? (
            <div id={subId} className="line-clamp-1 text-xs text-neutral-500">
              {subtitle}
            </div>
          ) : null}
        </div>

        <ChevronRight
          className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-neutral-600"
          aria-hidden="true"
        />
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
