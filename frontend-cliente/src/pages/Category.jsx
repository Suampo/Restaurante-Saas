import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../lib/ui.js";

// --- SUBCOMPONENTE: Esqueleto de carga (Skeleton) ---
function CategorySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {[...Array(10)].map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-xl bg-white p-3 shadow-sm">
          <div className="aspect-square w-full rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-4 w-3/4 rounded bg-gray-200 animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-gray-200 animate-pulse" />
        </div>
      ))}
    </div>
  );
}

// --- SUBCOMPONENTE: Icono de flecha atrás ---
function ArrowLeftIcon({ className }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
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

  return (
    // 1. CONTENEDOR PRINCIPAL: Fondo gris suave para resaltar las tarjetas
    <div className="flex min-h-screen w-full flex-col bg-gray-50/50">
      
      {/* 2. CABECERA STICKY: Se queda fija arriba con efecto blur */}
      <header className="sticky top-0 z-30 w-full border-b border-gray-200/80 bg-white/80 backdrop-blur-md transition-all">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          
          {/* Botón de volver mejorado (Circular y táctil) */}
          <button
            onClick={() => nav(-1)}
            className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 transition-colors hover:bg-emerald-100 hover:text-emerald-700 active:scale-95"
            aria-label="Volver atrás"
          >
            <ArrowLeftIcon className="h-5 w-5 text-gray-600 group-hover:text-emerald-700" />
          </button>

          {/* Títulos */}
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              {cat?.nombre ?? (loading ? "Cargando..." : "Categoría")}
            </h1>
            {restaurantName && (
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {restaurantName}
              </p>
            )}
          </div>
        </div>
      </header>

      {/* 3. CONTENIDO PRINCIPAL */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:px-6">
        
        {/* Estado de Error */}
        {error && !loading && (
          <div className="mx-auto mt-10 w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 shadow-sm">
            <p className="font-medium">Ocurrió un error al cargar el menú.</p>
            <p className="mt-1 text-sm opacity-80">{error}</p>
          </div>
        )}

        {/* Estado de Carga (Skeletons) */}
        {loading && <CategorySkeleton />}

        {/* Contenido Cargado */}
        {!loading && !error && (
          <>
            {items.length === 0 ? (
              // Estado Vacío (Empty State)
              <div className="flex flex-1 flex-col items-center justify-center py-20 text-center opacity-60">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-4xl">
                  🍽️
                </div>
                <h3 className="text-lg font-medium text-gray-900">Sin productos disponibles</h3>
                <p className="text-sm text-gray-500">Esta categoría aún no tiene items asignados.</p>
              </div>
            ) : (
              // Grid de Productos
              <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
                {items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    onAdd={(it) =>
                      window.dispatchEvent(
                        new CustomEvent("cart:add", { detail: { item: it } })
                      )
                    }
                    // Preservamos tu lógica de URL absoluta
                    absolute={(u) =>
                      absolute(
                        import.meta.env.VITE_API_PEDIDOS ||
                        import.meta.env.VITE_API_URL ||
                        "http://localhost:4000",
                        u
                      )
                    }
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