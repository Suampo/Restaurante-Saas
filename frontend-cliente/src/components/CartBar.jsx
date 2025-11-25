// src/components/CartBar.jsx
import React, { useEffect, useRef, useState } from "react";

/* --- ICONOS --- */
const IconCart = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" /><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" /></svg>
);
const IconCreditCard = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect width="20" height="14" x="2" y="5" rx="2" /><line x1="2" x2="22" y1="10" y2="10" /></svg>
);
const IconChef = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z" /><line x1="6" x2="18" y1="17" y2="17" /></svg>
);
const IconChevronRight = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>
);

export const CARTBAR_H = 80; // Ajustado ligeramente para mejor cálculo

export default function CartBar({
  itemCount,
  total,
  formatPEN,
  onOpenCart,
  onSend, // Opcional
  onPay,  // Ir a pagar
}) {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // 1. Manejo de entrada/salida suave
  useEffect(() => {
    if (itemCount > 0) {
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [itemCount]);

  // 2. Cálculo de altura
  useEffect(() => {
    const updateHeight = () => {
      const height = itemCount > 0 ? (wrapRef.current?.offsetHeight || CARTBAR_H) : 0;
      document.documentElement.style.setProperty("--cart-bar-h", `${height}px`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    const ro = new ResizeObserver(updateHeight);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      window.removeEventListener("resize", updateHeight);
      ro.disconnect();
      document.documentElement.style.setProperty("--cart-bar-h", "0px");
    };
  }, [itemCount]);

  if (itemCount <= 0) return null;

  const totalStr = formatPEN ? formatPEN(total) : `S/ ${Number(total).toFixed(2)}`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
      {/* Accesibilidad */}
      <div aria-live="polite" className="sr-only">
        {`Carrito con ${itemCount} items, total ${totalStr}`}
      </div>

      <div 
        ref={wrapRef}
        className={`
          pointer-events-auto w-full transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1)
          ${visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}
        `}
      >
        
        {/* === VISTA MÓVIL (< 640px): ISLA FLOTANTE PREMIUM === */}
        <div className="block sm:hidden px-4 pb-5 pt-2">
          <button 
            onClick={onOpenCart}
            className="
              group relative flex w-full items-center justify-between overflow-hidden 
              rounded-[20px] bg-[#1a1a1a] p-1.5 pr-5
              shadow-[0_8px_30px_rgb(0,0,0,0.3)] ring-1 ring-white/10
              transition-all active:scale-[0.97]
            "
          >
             {/* Círculo contador */}
             <div className="flex items-center gap-3.5">
                <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                   <span className="text-[15px] font-bold">{itemCount}</span>
                   {/* Badge animado sutil */}
                   <span className="absolute inset-0 rounded-full ring-2 ring-white/20 animate-pulse"></span>
                </div>
                
                <div className="flex flex-col items-start">
                   <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total</span>
                   <span className="text-[17px] font-bold text-white tabular-nums leading-none tracking-tight">
                     {totalStr}
                   </span>
                </div>
             </div>

             {/* Acción Derecha */}
             <div className="flex items-center gap-2 text-emerald-400">
                <span className="text-xs font-bold tracking-wide uppercase">Ver Pedido</span>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 transition-colors">
                   <IconChevronRight className="h-3.5 w-3.5" />
                </div>
             </div>

             {/* Brillo Hover */}
             <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          </button>
        </div>

        {/* === VISTA DESKTOP/TABLET (>= 640px): BARRA FROSTED === */}
        <div className="hidden sm:block border-t border-gray-200/60 bg-white/80 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex h-[88px] max-w-6xl items-center justify-between px-8">
            
            {/* Resumen Izquierda */}
            <div className="flex items-center gap-5">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <IconCart className="h-6 w-6" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                  {itemCount}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Total a Pagar</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-3xl font-black text-gray-900 tracking-tighter">{totalStr}</span>
                </div>
              </div>
            </div>

            {/* Botonera Derecha */}
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenCart}
                className="flex h-12 items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-6 text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all active:scale-95"
              >
                Ver detalles
              </button>

              {onSend && (
                <button
                  onClick={onSend}
                  className="flex h-12 items-center gap-2.5 rounded-xl bg-emerald-100 px-6 text-sm font-bold text-emerald-800 hover:bg-emerald-200 transition-all active:scale-95"
                >
                  <IconChef className="h-5 w-5" />
                  Cocina
                </button>
              )}

              <button
                onClick={onPay}
                className="flex h-12 items-center gap-2.5 rounded-xl bg-gray-900 px-8 text-sm font-bold text-white shadow-lg shadow-gray-900/20 hover:bg-black hover:shadow-gray-900/30 transition-all active:scale-95"
              >
                <IconCreditCard className="h-5 w-5" />
                Pagar Ahora
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}