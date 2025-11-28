// src/components/ProductCard.jsx
import React, { useMemo, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import ProductSheet from "./ProductSheet";

/* --- ICONOS --- */
const IconPlus = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconImageOff = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  </svg>
);

function ProductCard({ item, absolute, fallbackImg, formatPEN, onAdd }) {
  // ---------- IMAGEN ----------
  const imgUrl = useMemo(() => {
    if (!item) return fallbackImg;

    const raw =
      item.imagen_url ??
      item.cover_url ??
      item.image_url ??
      item.foto_url ??
      item.imagen ??
      "";

    if (!raw) return fallbackImg;
    return absolute ? absolute(raw) : raw;
  }, [item, absolute, fallbackImg]);

  const [imgError, setImgError] = useState(false);

  // ---------- PRECIO ----------
  const rawPrice =
    item?.precio_oferta ??
    item?.precio ??
    item?.price ??
    item?.precio_unitario ??
    0;

  const priceLabel = formatPEN
    ? formatPEN(rawPrice)
    : `S/ ${Number(rawPrice || 0).toFixed(2)}`;

  // ---------- SHEET & ANIMACIÓN BOTÓN ----------
  const [open, setOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const openSheet = useCallback(() => setOpen(true), []);
  const closeSheet = useCallback(() => setOpen(false), []);

  // QUICK ADD optimizado
  const handleQuickAdd = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();

      setIsPressed(true);
      setTimeout(() => setIsPressed(false), 200);

      const payload = { ...item };

      if (onAdd) {
        onAdd(payload);
      } else {
        window.dispatchEvent(
          new CustomEvent("cart:add", { detail: { item: payload } })
        );
      }
    },
    [item, onAdd]
  );

  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openSheet();
    }
  };

  const name = item?.nombre || "Producto";

  return (
    <>
      <article
        className="
          group relative w-full overflow-hidden rounded-2xl bg-white
          shadow-md ring-1 ring-black/5 transition-all duration-300
          hover:shadow-xl hover:-translate-y-1 cursor-pointer
        "
        onClick={openSheet}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="button"
        aria-label={`Ver detalles de ${name}`}
      >
        {/* Imagen 4:3 */}
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
          {!imgError && imgUrl ? (
            <img
              src={imgUrl}
              alt={name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 will-change-transform group-hover:scale-110"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <IconImageOff className="h-6 w-6" />
            </div>
          )}

          {/* Gradiente Oscuro */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-90 transition-opacity group-hover:opacity-100" />

          {/* Badge de Precio */}
          <div className="absolute top-2 right-2 overflow-hidden rounded-full border border-white/20 bg-black/50 backdrop-blur-md px-2 py-0.5 shadow-sm">
            <span className="text-[10px] font-bold text-white tracking-wide sm:text-xs">
              {priceLabel}
            </span>
          </div>

          {/* Contenido Inferior */}
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-2 sm:p-3">
            {/* Texto */}
            <div className="flex-1 min-w-0 pr-1.5 pb-0.5">
              <h3
                className="line-clamp-2 text-xs font-bold leading-tight text-white drop-shadow-md sm:text-sm sm:leading-snug"
                title={name}
              >
                {name}
              </h3>
              <p className="mt-0.5 text-[10px] font-medium text-gray-300 flex items-center gap-0.5 sm:text-xs">
                <span>Ver detalles</span>
                <svg
                  className="w-2.5 h-2.5 opacity-70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </p>
            </div>

            {/* Botón Flotante */}
            <button
              type="button"
              onClick={handleQuickAdd}
              className={`
                flex-shrink-0 relative
                flex h-8 w-8 items-center justify-center rounded-full
                bg-emerald-500 text-white
                shadow-lg shadow-emerald-500/30
                border border-white/10
                transition-all duration-200 ease-out
                sm:h-9 sm:w-9
                ${
                  isPressed
                    ? "scale-90 bg-emerald-600 shadow-none"
                    : "hover:scale-110 hover:bg-emerald-400"
                }
              `}
              aria-label={`Agregar ${name} al carrito`}
            >
              <IconPlus className="h-4 w-4 drop-shadow-sm" />
            </button>
          </div>
        </div>
      </article>

      {/* Sheet de detalles */}
      {open &&
        createPortal(
          <ProductSheet open={open} item={item} onClose={closeSheet} />,
          document.body
        )}
    </>
  );
}

// Muy importante: esto evita re-renders masivos al scrollear
export default React.memo(ProductCard);
