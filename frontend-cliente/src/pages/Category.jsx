// src/pages/Category.jsx
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../lib/ui.js";

// --- SUBCOMPONENTE: Icono de flecha atrás (Más minimalista) ---
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

// --- SUBCOMPONENTE: Esqueleto de carga (Ajustado al nuevo grid) ---
function CategorySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 rounded-2xl bg-white p-2 shadow-sm border border-gray-100"
        >
          {/* Simula la imagen 4:3 */}
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

  const items = Array.isArray(cat?.items) ? cat.items : [];

  const apiBase =
    import.meta.env.VITE_API_PEDIDOS ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50">
      
      {/* CABECERA STICKY MEJORADA 
         - backdrop-blur-md para efecto vidrio real
         - z-40 para asegurar que flote sobre todo
      */}
      <header className="sticky top-0 z-40 w-full border-b border-gray-200/60 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:py-4">
          
          <button
            onClick={() => nav(-1)}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-transparent hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Volver atrás"
          >
            <ArrowLeftIcon className="h-6 w-6 text-gray-800 group-hover:text-black transition-colors" />
          </button>

          <div className="flex flex-col min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight text-gray-900 sm:text-2xl">
              {cat?.nombre ?? (loading ? "Cargando..." : "Categoría")}
            </h1>
            {restaurantName && (
              <p className="truncate text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {restaurantName}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL
         - px-3: Reduce padding lateral en móviles (gana espacio)
         - sm:px-6: Padding normal en tablets/PC
      */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
        
        {/* Error State */}
        {error && !loading && (
          <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-red-100 bg-red-50 p-6 text-center shadow-sm">
            <p className="font-bold text-red-800">No pudimos cargar el menú 😔</p>
            <p className="mt-1 text-sm text-red-600/80">{error}</p>
            <button 
                onClick={() => window.location.reload()}
                className="mt-4 text-sm font-semibold text-red-700 underline"
            >
                Reintentar
            </button>
          </div>
        )}

        {/* Skeleton */}
        {loading && <CategorySkeleton />}

        {/* Lista de Productos */}
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
              /* GRID OPTIMIZADO PARA MÓVIL (La clave está aquí)
                 - gap-3: Espacio reducido entre cartas (12px) en móvil.
                 - gap-y-5: Un poco más de espacio vertical.
              */
              <div className="grid grid-cols-2 gap-3 gap-y-5 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both">
                {items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onAdd={(it) =>
                      window.dispatchEvent(
                        new CustomEvent("cart:add", { detail: { item: it } })
                      )
                    }
                    absolute={(u) => absolute(apiBase, u)}
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