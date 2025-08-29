// src/components/CartSheet.jsx
export default function CartSheet({
  open,
  onClose,
  cart,
  total,
  formatPEN,
  absolute,
  fallbackImg,
  onAdd,      // índice
  onRemove,   // índice
  onSend,
  onPay       // NUEVO: para pagar con Culqi
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-2xl bg-white p-4 shadow-xl">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900">🛒 Tu carrito</h3>
            <button
              className="rounded-lg border px-3 py-1.5 text-sm text-neutral-900"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>

          {cart.length === 0 ? (
            <p className="text-neutral-600">Vacío</p>
          ) : (
            <>
              <div className="space-y-3">
                {cart.map((item, idx) => {
                  const unit = Number(item.isCombo ? item.precio : item.precio || 0);
                  const lineTotal = unit * item.cantidad;
                  const imgSrc =
                    absolute(item.isCombo ? item.entrada?.imagen_url : item.imagen_url) ||
                    fallbackImg;

                  return (
                    <div
                      key={`cart-${idx}-${item.isCombo ? "combo" : "item"}`}
                      className="flex items-center gap-3 rounded-xl text-neutral-900 p-3 shadow-sm ring-1 ring-black/5"
                    >
                      <img
                        src={imgSrc}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = fallbackImg;
                        }}
                        alt={item.isCombo ? item.nombreCombo : item.nombre}
                        className="h-12 w-12 rounded-md object-cover"
                      />

                      <div className="flex-1">
                        <div className="font-medium leading-tight">
                          {item.isCombo ? item.nombreCombo : item.nombre}
                        </div>
                        <div className="text-sm text-neutral-600">
                          {item.isCombo
                            ? `${item.entrada?.nombre} + ${item.plato?.nombre}`
                            : item.descripcion}
                        </div>
                        <div className="text-sm text-neutral-600">
                          {item.cantidad} x {formatPEN(unit)} ={" "}
                          <strong>{formatPEN(lineTotal)}</strong>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onRemove(idx)}
                          className="h-9 w-9 rounded-lg border text-neutral-900 hover:bg-neutral-100"
                          aria-label="Quitar uno"
                        >
                          −
                        </button>
                        <button
                          onClick={() => onAdd(idx)}
                          className="h-9 w-9 rounded-lg border text-neutral-900 hover:bg-neutral-100"
                          aria-label="Agregar uno"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="text-lg font-semibold">Total: {formatPEN(total)}</div>
                <div className="flex gap-2">
                  <button
                    onClick={onPay}
                    className="h-11 rounded-xl bg-emerald-600 px-5 text-white transition hover:bg-emerald-500"
                  >
                    Pagar Pedido
                  </button>
                  
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
