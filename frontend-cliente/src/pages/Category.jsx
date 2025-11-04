import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../lib/ui.js";

export default function Category() {
  const nav = useNavigate();
  const { id } = useParams();
  const { categories = [], restaurantName, loading, error } = useMenuPublic();

  const cat = useMemo(
    () => categories.find((c) => String(c.id) === String(id)),
    [categories, id]
  );

  const items = Array.isArray(cat?.items) ? cat.items : [];

  return (
    // 1. CONTENEDOR PRINCIPAL: Ocupa toda la altura y usa flex-col
   <div className="flex flex-col w-full flex-1 bg-white">
      
      {/* 2. CABECERA: Contiene tu título y botón. No se encoge. */}
      <header className="w-full max-w-6xl px-4 pt-6 mx-auto shrink-0">
        <button
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm text-emerald-700 hover:underline"
        >
          ← Volver
        </button>

        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
          {cat?.nombre ?? "Categoría"}
        </h1>
        <p className="mb-4 text-sm text-neutral-500">
          {restaurantName || "Restaurante"}
        </p>
      </header>

      {/* 3. CONTENIDO PRINCIPAL: Ocupa el resto del espacio (flex-1) */}
      <main className="w-full max-w-6xl px-4 pb-6 mx-auto flex-1">
        {loading && (
          <div className="rounded-lg border bg-white p-6 text-neutral-600">
            Cargando productos...
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <div className="rounded-lg border bg-white p-6 text-neutral-600">
                Sin productos en esta categoría.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 animate-fadeInUp">
                {items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onAdd={(it) =>
                      window.dispatchEvent(
                        new CustomEvent("cart:add", { detail: { item: it } })
                      )
                    }
                    absolute={(u) => absolute(import.meta.env.VITE_API_PEDIDOS || import.meta.env.VITE_API_URL || "http://localhost:4000", u)}
                    fallbackImg={FALLBACK_IMG}
                    formatPEN={formatPEN}
                    variant="hero"
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}