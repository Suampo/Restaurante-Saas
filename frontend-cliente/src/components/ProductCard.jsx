// src/components/ProductCard.jsx
import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ProductSheet from "./ProductSheet";

/* --- ICONOS MÁS FINOS --- */
const IconPlus = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconEye = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconImageOff = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
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

  // Precio formateado
  const priceLabel = formatPEN 
    ? formatPEN(item?.precio || 0) 
    : `S/ ${Number(item?.precio || 0).toFixed(2)}`;

  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  const handleQuickAdd = (e) => {
    e.stopPropagation();
    // Pequeña animación de pulsación
    setIsPressed(true);
    setTimeout(() => setIsPressed(false), 150);
    
    window.dispatchEvent(
      new CustomEvent("cart:add", { detail: { item: { ...item } } })
    );
  };

  return (
    <>
      <div className="group relative flex flex-col gap-1.5"> {/* Gap reducido */}
        
        {/* --- A. IMAGEN --- */}
        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl bg-gray-100 cursor-pointer"
          onClick={() => setOpen(true)}
          role="button"
          tabIndex={0}
        >
          {!imgError ? (
            <img
              src={imgUrl}
              alt={item?.nombre}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-50 text-gray-300">
              <IconImageOff className="h-6 w-6" />
            </div>
          )}

          {/* Sombra interior sutil para que los botones blancos resalten */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />

          {/* BOTÓN DETALLES (Ojo): Muy discreto */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm transition active:scale-90"
          >
            <IconEye className="h-3 w-3" />
          </button>

          {/* BOTÓN AGREGAR (+): Compacto (32px) */}
          <button
            type="button"
            onClick={handleQuickAdd}
            className={`
              absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full 
              bg-emerald-600 text-white shadow-md shadow-emerald-900/10
              transition-transform duration-200
              ${isPressed ? "scale-90 bg-emerald-700" : "hover:scale-105 hover:bg-emerald-500"}
            `}
          >
            <IconPlus className="h-4 w-4" />
          </button>
        </div>

        {/* --- B. INFORMACIÓN (Texto más fino) --- */}
        <div className="flex flex-col px-0.5">
          {/* Precio: Tamaño 15px (text-[15px]), Peso Bold, Color Oscuro */}
          <div className="text-[15px] font-bold text-gray-900 leading-none tracking-tight">
            {priceLabel}
          </div>
          
          {/* Nombre: Tamaño 12px (text-xs), Color Gris Medio, Sin negrita */}
          <h3 
            className="mt-1 text-xs text-gray-500 font-medium leading-snug line-clamp-2 cursor-pointer group-hover:text-emerald-700 transition-colors"
            onClick={() => setOpen(true)}
          >
            {item?.nombre || "Producto"}
          </h3>
        </div>
      </div>

      {/* --- PORTAL --- */}
      {open && createPortal(
        <ProductSheet open={open} item={item} onClose={() => setOpen(false)} />,
        document.body
      )}
    </>
  );
} 