// src/components/ProductCard.jsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ProductSheet from "./ProductSheet";

/* Iconos inline */
const Plus = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const Info = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8h.01M11 12h2v5h-2z" />
  </svg>
);

export default function ProductCard({
  item,
  absolute,
  fallbackImg,
  formatPEN,
}) {
  const imgUrl = useMemo(
    () => absolute?.(item?.imagen_url) || fallbackImg,
    [absolute, item?.imagen_url, fallbackImg]
  );

  const price =
    (formatPEN && formatPEN(item?.precio || 0)) ||
    `S/ ${Number(item?.precio || 0).toFixed(2)}`;

  const [imgOk, setImgOk] = useState(true);
  const [open, setOpen] = useState(false);

  const addQuick = () =>
    window.dispatchEvent(
      new CustomEvent("cart:add", { detail: { item: { ...item } } })
    );

  // --- Portal del sheet (escapa de cualquier transform del grid) ---
  const sheetPortal =
    open && typeof document !== "undefined"
      ? createPortal(
          <ProductSheet open={open} item={item} onClose={() => setOpen(false)} />,
          document.body
        )
      : null;

  return (
    <>
      <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm overflow-hidden transition hover:shadow-md">
        {/* Media 1:1 con margen interno y bordes redondeados */}
        <div className="p-2">
          <div
            className="relative aspect-square w-full overflow-hidden rounded-2xl bg-white cursor-pointer"
            onClick={() => setOpen(true)}
            role="button"
            aria-label={`Ver detalles de ${item?.nombre || "producto"}`}
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(true)}
          >
            {imgOk ? (
              <img
                src={imgUrl}
                alt={item?.nombre || "Producto"}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                onError={() => setImgOk(false)}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center bg-neutral-50 text-sm text-neutral-400">
                Sin imagen
              </div>
            )}

            {/* Botón Detalles */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              aria-label="Ver detalles"
              className="absolute left-2 top-2 grid h-9 w-9 place-items-center rounded-full
                         border border-neutral-200 bg-white text-neutral-700 shadow-sm
                         transition hover:bg-neutral-50"
            >
              <Info className="h-5 w-5" />
            </button>

            {/* Botón Agregar (+) */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); addQuick(); }}
              aria-label="Agregar"
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full
                         bg-emerald-600 text-white shadow-md transition hover:bg-emerald-500"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Precio + nombre */}
        <div className="px-3 pb-3">
          <div className="text-[15px] font-extrabold text-neutral-900">{price}</div>
          <div className="mt-1 text-[13px] text-neutral-700 leading-snug line-clamp-2">
            {item?.nombre || "Producto"}
          </div>
        </div>
      </div>

      {/* Montado en portal */}
      {sheetPortal}
    </>
  );
}
