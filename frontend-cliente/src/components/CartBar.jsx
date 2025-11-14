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
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m9 18 6-6-6-6"/></svg>
);

export const CARTBAR_H = 72;

export default function CartBar({
  itemCount,
  total,
  formatPEN,
  onOpenCart,
  onSend, // Opcional (enviar a cocina directo)
  onPay,  // Ir a pagar
}) {
  const wrapRef = useRef(null);
  const [visible, setVisible] = useState(false);

  // 1. Manejo de entrada/salida suave
  useEffect(() => {
    if (itemCount > 0) {
      // Pequeño delay para permitir que el DOM se monte antes de animar la opacidad
      const t = setTimeout(() => setVisible(true), 50);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [itemCount]);

  // 2. Cálculo de altura para CSS Variable (Padding inferior global)
  useEffect(() => {
    const updateHeight = () => {
      const height = itemCount > 0 ? (wrapRef.current?.offsetHeight || CARTBAR_H) : 0;
      document.documentElement.style.setProperty("--cart-bar-h", `${height}px`);
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    
    // Observer por si el contenido cambia de tamaño
    const ro = new ResizeObserver(updateHeight);
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      window.removeEventListener("resize", updateHeight);
      ro.disconnect();
      document.documentElement.style.setProperty("--cart-bar-h", "0px");
    };
  }, [itemCount]);

  // No renderizar nada si no hay items (excepto para animar salida, pero aquí desmontamos simple)
  if (itemCount <= 0) return null;

  // Formateo seguro
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
        
        {/* === VISTA MÓVIL (< 640px): ISLA FLOTANTE === */}
        <div className="block sm:hidden px-4 pb-4 pt-2">
          <div 
            onClick={onOpenCart}
            className="group relative flex w-full items-center justify-between overflow-hidden rounded-2xl bg-gray-900 p-1 shadow-2xl shadow-gray-900/20 ring-1 ring-white/10 cursor-pointer active:scale-[0.98] transition-transform"
          >
             {/* Lado Izquierdo: Info */}
             <div className="flex flex-1 items-center gap-3 px-4 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-900/50">
                   <span className="text-sm font-bold">{itemCount}</span>
                </div>
                <div className="flex flex-col">
                   <span className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">Total</span>
                   <span className="text-lg font-bold text-white leading-none">{totalStr}</span>
                </div>
             </div>

             {/* Lado Derecho: Acción */}
             <div className="flex items-center gap-2 pr-5 text-sm font-semibold text-emerald-400 group-hover:text-emerald-300">
                <span>Ver Pedido</span>
                <IconChevronRight className="h-4 w-4" />
             </div>

             {/* Fondo Decorativo */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* === VISTA DESKTOP/TABLET (>= 640px): BARRA COMPLETA === */}
        <div className="hidden sm:block border-t border-gray-200/80 bg-white/90 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex h-[80px] max-w-6xl items-center justify-between px-6">
            
            {/* Resumen */}
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <IconCart className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Resumen del pedido</p>
                <div className="flex items-baseline gap-2">
                   <span className="text-2xl font-extrabold text-gray-900 tracking-tight">{totalStr}</span>
                   <span className="text-sm font-medium text-gray-400">({itemCount} productos)</span>
                </div>
              </div>
            </div>

            {/* Botonera */}
            <div className="flex items-center gap-3">
              <button
                onClick={onOpenCart}
                className="flex h-12 items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition active:scale-95"
              >
                Ver detalles
              </button>

              {onSend && (
                <button
                  onClick={onSend}
                  className="flex h-12 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-6 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition active:scale-95"
                >
                  <IconChef className="h-5 w-5" />
                  Cocina
                </button>
              )}

              <button
                onClick={onPay}
                className="flex h-12 items-center gap-2 rounded-xl bg-emerald-600 px-8 text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 hover:shadow-emerald-600/40 transition active:scale-95 active:shadow-none"
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