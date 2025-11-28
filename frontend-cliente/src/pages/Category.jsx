// src/pages/Category.jsx
import { useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../lib/ui.js";

// Icono flecha atrás (compacto)
function ArrowLeftIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 19l-7-7 7-7" />
    </svg>
  );
}

// Skeleton de carga
function CategorySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl bg-white p-2 shadow-sm border border-gray-100"
        >
          <div className="aspect-[4/3] w-full rounded-xl bg-gray-200 animate-pulse" />
          <div className="flex justify-between items-end px-1">
            <div className="h-4 w-2/3 rounded bg-gray-200 animate-pulse" />
            <div className="h-6 w-6 rounded-full bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Category() {
  const nav = useNavigate();
  const { id } = useParams();

  const { categories = [], restaurantName, loading, error } = useMenuPublic();

  const cat = useMemo(
    () => categories.find((c) => String(c.id) === String(id)),
    [categories, id]
  );

  const items = useMemo(
    () => (Array.isArray(cat?.items) ? cat.items : []),
    [cat]
  );

  const apiBase =
    import.meta.env.VITE_API_PEDIDOS ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  const makeAbsolute = useCallback(
    (u) => absolute(apiBase, u),
    [apiBase]
  );

  const handleAdd = useCallback((it) => {
    window.dispatchEvent(
      new CustomEvent("cart:add", { detail: { item: it } })
    );
  }, []);

  const title =
    cat?.nombre ??
    (loading ? "Cargando categoría…" : "Categoría sin nombre");

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-4 gap-4 sm:gap-6">
        {/* CABECERA LIGERA (reemplaza al bloque grande de la foto 1) */}
        <section className="sticky top-0 z-30 -mx-3 mb-2 border-b border-gray-200/70 bg-gray-50/95 px-3 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => nav(-1)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 active:scale-95"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>Volver al inicio</span>
            </button>

            <div className="min-w-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gray-500">
                Categoría
              </p>
              <h1 className="truncate text-base font-bold text-gray-900 sm:text-lg">
                {title}
              </h1>
              {restaurantName && (
                <p className="truncate text-[11px] text-gray-500">
                  {restaurantName}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Error */}
        {error && !loading && (
          <div className="mx-auto mt-6 w-full max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center shadow-sm">
            <p className="font-bold text-red-800">
              No pudimos cargar el menú 😔
            </p>
            <p className="mt-1 text-sm text-red-600/80">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 text-sm font-semibold text-red-700 underline"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && <CategorySkeleton />}

        {/* Lista de productos */}
        {!loading && !error && (
          <>
            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gray-100 text-5xl grayscale opacity-50">
                  🍽️
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  ¡Vaya! Está vacío
                </h3>
                <p className="mt-2 text-sm text-gray-500 max-w-[250px] mx-auto">
                  No hay productos en esta categoría por el momento.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 gap-y-5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                {items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onAdd={handleAdd}
                    absolute={makeAbsolute}
                    fallbackImg={FALLBACK_IMG}
                    formatPEN={formatPEN}
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
