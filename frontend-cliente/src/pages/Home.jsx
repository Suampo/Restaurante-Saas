import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import CategoryTile from "../components/CategoryTile";
import RestaurantHeader from "../components/RestaurantHeader";

const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
    <rect width='100%' height='100%' fill='#e5e7eb'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          font-family='Arial, sans-serif' font-size='16' fill='#6b7280'>Sin imagen</text>
  </svg>`);

export default function Home() {
  const nav = useNavigate();
  const combosRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [stepPx, setStepPx] = useState(280);

  const {
    loading,
    error,
    categories = [],
    combos = [],
    mesaId,
    mesaCode,
    restaurantName,
  } = useMenuPublic();

  const mesaText = mesaCode ? `#${mesaCode}` : mesaId ? `#MESA-${mesaId}` : "—";

  const updateArrows = useCallback(() => {
    const el = combosRef.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setAtStart(scrollLeft <= 2);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 2);
  }, []);

  const recalcStep = useCallback(() => {
    const el = combosRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const gap = parseFloat(style.gap || "16") || 16;
    const item = el.querySelector(".combo-item");
    const w = (item?.offsetWidth || 240) + gap;
    setStepPx(w);
    updateArrows();
  }, [updateArrows]);

  useEffect(() => {
    recalcStep();
    const el = combosRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", recalcStep);

    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", recalcStep);
    };
  }, [combos.length, recalcStep, updateArrows]);

  const scrollByCards = (dir) => {
    combosRef.current?.scrollBy({ left: dir * stepPx, behavior: "smooth" });
  };

  const ArrowButton = ({ direction, disabled, onClick }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Desplazar a la ${direction === "left" ? "izquierda" : "derecha"}`}
      className={`arrow-btn absolute ${direction === "left" ? "-left-4" : "-right-4"} 
        top-1/2 z-10 -translate-y-1/2 ${disabled ? "opacity-40 pointer-events-none" : ""}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24">
        <path
          d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 6l6 6-6 6"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </button>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28">
      <RestaurantHeader name={restaurantName} mesaText={mesaText} loading={loading} />

      {/* ================= Combos ================= */}
      {combos.length > 0 && (
        <>
          <h2 className="mb-3 text-base md:text-lg font-semibold text-neutral-900">Combos</h2>

          {/* --- Mobile: carrusel --- */}
          <div className="relative md:hidden animate-fadeInLeft">
            {combos.length > 1 && (
              <ArrowButton direction="left" disabled={atStart} onClick={() => scrollByCards(-1)} />
            )}

            <div
              ref={combosRef}
              className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 px-1 no-scrollbar"
            >
              <div className="shrink-0 w-1" aria-hidden />
              {combos.map((co) => (
                <div
                  key={co.id}
                  className="combo-item shrink-0 snap-start basis-[calc(50%-0.5rem)] tile-hover"
                >
                  <CategoryTile
                    title={co.nombre}
                    subtitle={co?.descripcion || "Elige 1 entrada + 1 fondo"}
                    image={co.cover_url}
                    fallback={FALLBACK}
                    onClick={() => nav(`/combo${location.search}`)}
                  />
                </div>
              ))}
              <div className="shrink-0 w-1" aria-hidden />
            </div>

            {combos.length > 1 && (
              <ArrowButton direction="right" disabled={atEnd} onClick={() => scrollByCards(1)} />
            )}

            <div className="carousel-gradient-left" />
            <div className="carousel-gradient-right" />
          </div>

          {/* --- Desktop: grid --- */}
          <div className="hidden md:grid md:gap-3 lg:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-fadeInUp">
            {combos.map((co) => (
              <CategoryTile
                key={co.id}
                title={co.nombre}
                subtitle={co?.descripcion || "Elige 1 entrada + 1 fondo"}
                image={co.cover_url}
                fallback={FALLBACK}
                onClick={() => nav(`/combo${location.search}`)}
                className="tile-hover"
              />
            ))}
          </div>

          <div className="my-6 h-px bg-neutral-200/60" />
        </>
      )}

      {/* ================= Categorías ================= */}
      <h2 className="mb-3 text-base font-semibold text-neutral-900">Empieza tu pedido aquí</h2>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[4/3] animate-pulse rounded-2xl bg-neutral-200" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-fadeInUp">
          {categories.map((c) => (
            <CategoryTile
              key={c.id ?? "otros"}
              title={c.nombre}
              image={c.cover_url || FALLBACK}
              fallback={FALLBACK}
              onClick={() => c.id != null && nav(`/categoria/${c.id}${location.search}`)}
              className="tile-hover"
            />
          ))}
        </div>
      )}
    </div>
  );
}