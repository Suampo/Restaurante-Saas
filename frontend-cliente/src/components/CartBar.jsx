// CartBar.jsx
export const CARTBAR_H = 72;

export default function CartBar({
  itemCount,
  total,
  formatPEN,
  onOpenCart,
  onSend,
  onPay,
}) {
  if (itemCount <= 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none">
      <div className="mx-auto max-w-6xl px-3 pb-[env(safe-area-inset-bottom)]">
        <div
          className="pointer-events-auto h-[72px] rounded-t-2xl border border-neutral-200
                     bg-white/95 backdrop-blur shadow-[0_-8px_24px_rgba(0,0,0,0.08)]"
        >
          <div className="flex h-full items-center gap-3 px-3 sm:px-4">
            {/* Total */}
            <div className="min-w-0">
              <div className="text-[12px] text-neutral-500">
                {itemCount} ítem{itemCount > 1 && "s"} · Total
              </div>
              <div className="text-[14px] font-bold tracking-tight text-neutral-900 leading-tight">
                {formatPEN(total)}
              </div>
            </div>

            {/* Acciones */}
            <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
              <button
                onClick={onOpenCart}
                aria-label="Ver carrito"
                className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-3
                           text-[14px] font-medium text-neutral-800 hover:bg-neutral-50 active:translate-y-[1px] transition"
              >
                <CartIcon className="h-5 w-5" />
                {/* El texto solo en >=640px para no romper layout */}
                <span className="ml-2 hidden sm:inline">Ver carrito</span>
              </button>

              <button
                onClick={onPay}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4
                           text-[15px] font-semibold text-white shadow-sm hover:bg-emerald-700
                           active:translate-y-[1px] transition whitespace-nowrap flex-1 sm:flex-none min-w-[150px]"
              >
                <CardIcon className="mr-2 h-5 w-5" />
                Pagar pedido
              </button>
            </div>
          </div>
        </div>
      </div>
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
