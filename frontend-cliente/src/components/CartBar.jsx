  // src/components/CartBar.jsx
  import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

  export const CARTBAR_H = 72;

  export default function CartBar({
    itemCount,
    total,
    formatPEN,
    onOpenCart,
    onSend,   // opcional
    onPay,
  }) {
    const [mounted, setMounted] = useState(false);
    const wrapRef = useRef(null);

    // Animación de aparición / desaparición
    useEffect(() => {
      if (itemCount > 0) {
        const t = setTimeout(() => setMounted(true), 0);
        return () => clearTimeout(t);
      }
      setMounted(false);
    }, [itemCount]);

    // Actualiza la variable CSS con la altura real del CartBar
    useLayoutEffect(() => {
      if (itemCount <= 0) {
        document.documentElement.style.setProperty("--cart-bar-h", "0px");
        return;
      }
      const el = wrapRef.current;
      const setVar = () => {
        const h = el?.offsetHeight ?? CARTBAR_H;
        document.documentElement.style.setProperty("--cart-bar-h", `${h}px`);
      };
      setVar();
      const ro = new ResizeObserver(setVar);
      if (el) ro.observe(el);
      return () => {
        ro.disconnect();
        document.documentElement.style.setProperty("--cart-bar-h", "0px");
      };
    }, [itemCount]);

    if (itemCount <= 0) return null;

    return (
      <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
        {/* live region para lectores de pantalla */}
        <div aria-live="polite" className="sr-only">
          {`Carrito: ${itemCount} ítem${itemCount > 1 ? "s" : ""}, total ${formatPEN(total)}`}
        </div>

        <div className="mx-auto max-w-6xl px-3 pb-[env(safe-area-inset-bottom)]">
          <div
            ref={wrapRef}
            className={`
              pointer-events-auto relative
              rounded-t-2xl bg-white/85 backdrop-blur-xl
              ring-1 ring-black/5 shadow-[0_-12px_28px_rgba(0,0,0,0.12)]
              transition-all duration-300 ease-out
              ${mounted ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}
            `}
            style={{ willChange: "transform, opacity" }}
          >
            {/* Alto fijo preferido para layout, pero el valor real se mide con ResizeObserver */}
            <div className="flex h-[72px] items-center gap-3 px-3 sm:px-4">
              {/* hairline superior con degradado */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neutral-200 to-transparent" />

              {/* Total */}
              <div className="min-w-0">
                <div className="text-[12px] text-neutral-500">
                  {itemCount} ítem{itemCount > 1 && "s"} · Total
                </div>
                <div className="leading-tight text-[15px] font-extrabold tracking-tight text-neutral-900">
                  {formatPEN(total)}
                </div>
              </div>

              {/* Acciones */}
              <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
                {/* Ver carrito */}
                <button
                  onClick={onOpenCart}
                  aria-label="Ver carrito"
                  className="relative inline-flex h-11 items-center rounded-xl border border-neutral-300
                            bg-white px-3 text-[14px] font-medium text-neutral-800
                            shadow-sm transition active:translate-y-[1px] hover:bg-neutral-50"
                >
                  <CartIcon className="h-5 w-5" />
                  <span className="ml-2 hidden sm:inline">Ver carrito</span>
                  <span className="absolute -right-2 -top-2 grid h-5 min-w-[20px] place-items-center rounded-full
                                  bg-emerald-600 px-1 text-[11px] font-semibold text-white shadow ring-1 ring-emerald-700/30">
                    {itemCount}
                  </span>
                </button>

                {/* Enviar a cocina (opcional) */}
                {onSend && (
                  <button
                    onClick={onSend}
                    className="hidden sm:inline-flex h-11 items-center rounded-xl border px-3 text-[14px]
                              font-medium text-neutral-900 shadow-sm hover:bg-neutral-50 active:translate-y-[1px] transition"
                  >
                    <FireIcon className="mr-2 h-5 w-5" />
                    Enviar a cocina
                  </button>
                )}

                {/* Pagar */}
                <button
                  onClick={onPay}
                  className="inline-flex h-11 min-w-[150px] flex-1 items-center justify-center whitespace-nowrap
                            rounded-xl bg-gradient-to-t from-emerald-600 to-emerald-500 px-4
                            text-[15px] font-semibold text-white shadow-sm ring-1 ring-emerald-700/20
                            transition hover:from-emerald-500 hover:to-emerald-400 active:translate-y-[1px]
                            sm:flex-none"
                >
                  <CardIcon className="mr-2 h-5 w-5" />
                  Pagar pedido
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Gradiente justo por encima (usa la altura real del CartBar) */}
        <div
          className="pointer-events-none absolute inset-x-0"
          style={{
            bottom: "var(--cart-bar-h, 0px)",
            height: "24px",
            background: "linear-gradient(to top, rgba(0,0,0,.06), transparent)",
          }}
        />
      </div>
    );
  }

  /* Iconos */
  function CartIcon(props) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <path d="M6 6h15l-1.5 9h-12z" />
        <path d="M6 6l-1-3H3" />
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="18" cy="20" r="1.5" />
      </svg>
    );
  }
  function CardIcon(props) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
        <rect x="2.5" y="5.5" width="19" height="13" rx="2.5" />
        <path d="M2.5 9.5h19" />
      </svg>
    );
  }
  function FireIcon(props) {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M13.5 2.5s.5 2.5-1.5 4.5c-1.2 1.2-1.9 2.3-2 3.5-.1 1.5.8 2.8 2.5 3.3a3.5 3.5 0 0 1-3-1.8c-1-1.8-.6-4 .8-5.8C12 4.2 13.5 2.5 13.5 2.5zM12 22c-3.3 0-6-2.4-6-5.5 0-2.1 1.4-4.1 3.5-5.1-.2.7-.3 1.3-.3 2 0 3 2.2 5.1 5.1 5.1 1.8 0 3.2-1 3.7-2.6.3.7.5 1.4.5 2.1C18.5 19.8 15.7 22 12 22z" />
      </svg>
    );
  }
