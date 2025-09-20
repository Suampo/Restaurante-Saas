import React from "react";

export default function ProductCard({
  item,
  onAdd,
  absolute,
  fallbackImg,
  formatPEN,
  variant = "card", // "card" | "hero"
}) {
  const imgUrl = absolute?.(item?.imagen_url) || fallbackImg;
  const price = formatPEN?.(item?.precio || 0);

  const handleAdd = () => {
    if (typeof onAdd === "function") onAdd(item);
  };

  // Alturas distintas para hero vs card
  const imgClass =
    variant === "hero"
      ? "h-40 w-full object-cover transition-transform duration-300 group-hover:scale-105"
      : "h-32 w-full object-cover transition-transform duration-300 group-hover:scale-105";

  return (
    <div
      className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm 
                 transition-all duration-300 hover:shadow-lg hover:-translate-y-[2px] animate-fadeInUp"
    >
      {/* Imagen */}
      <div className="relative overflow-hidden">
        <img
          src={imgUrl}
          onError={(e) => {
            e.currentTarget.src = fallbackImg;
          }}
          alt={item?.nombre || "Producto"}
          className={imgClass}
          loading="lazy"
        />

        {/* Precio (pill) */}
        <div className="absolute left-2 top-2 rounded-full bg-black/80 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
          {price}
        </div>
      </div>

      {/* Contenido */}
      <div className="space-y-2 p-3">
        <div className="line-clamp-2 text-[15px] font-semibold text-neutral-900">
          {item?.nombre || "Producto"}
        </div>
        {item?.descripcion && (
          <p className="line-clamp-2 text-xs text-neutral-500">
            {item.descripcion}
          </p>
        )}

        {/* Botón agregar */}
        <button
          onClick={handleAdd}
          aria-label={`Agregar ${item?.nombre || "producto"} al carrito`}
          className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white 
                     transition-all duration-200 hover:bg-emerald-700 active:translate-y-[1px] 
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}