// src/components/CartBar.jsx
export const CARTBAR_H = 72; // altura aprox en px de la barra

export default function CartBar({ itemCount, total, formatPEN, onOpenCart, onSend, onPay }) {
  if (itemCount <= 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t text-neutral-900 bg-white/90 backdrop-blur"
      // para iPhone con notch / safe area
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="text-sm">
          <div className="font-semibold">{itemCount} ítem(s)</div>
          <div className="text-neutral-600">Total: {formatPEN(total)}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenCart}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100"
          >
            Ver carrito
          </button>
          <button
            onClick={onPay}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Pagar Pedido
          </button>
        </div>
      </div>
    </div>
  );
}
