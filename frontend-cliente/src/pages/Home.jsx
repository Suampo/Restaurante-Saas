// src/pages/Home.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { useNavigate } from "react-router-dom";
import { useMenuPublic } from "../hooks/useMenuPublic";
import CategoryTile from "../components/CategoryTile";
import RestaurantHeader from "../components/RestaurantHeader";
import ComboCard from "../components/ComboCard";

/* Imagen fallback inline */
const FALLBACK =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360'>
    <rect width='100%' height='100%' fill='#e5e7eb'/>
    <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
          font-family='Arial, sans-serif' font-size='16' fill='#6b7280'>Sin imagen</text>
  </svg>`);

/* UI helpers */
const SectionTitle = ({ id, children, right }) => (
  <div className="mb-3 flex items-end justify-between">
    <h2
      id={id}
      className="text-[15px] sm:text-base md:text-lg font-semibold text-neutral-900 tracking-tight"
    >
      {children}
    </h2>
    {right || null}
  </div>
);

const EmptyState = ({ children }) => (
  <div className="rounded-xl border border-neutral-200 bg-white p-5 text-neutral-600">
    {children}
  </div>
);

const Divider = () => (
  <div className="my-6 h-px bg-gradient-to-r from-transparent via-neutral-200/60 to-transparent" />
);

/* --- ICONOS DE CONTACTO --- */
const MapPinIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const PhoneIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

/* --- FOOTER COMPACTO --- */
const BusinessFooter = ({ name, address, phone }) => {
  if (!name && !address && !phone) return null;
  const year = new Date().getFullYear();

  return (
    <footer
      className="
        mt-6 w-full border-t border-gray-100
        pt-4 pb-0 text-center
        animate-in fade-in duration-700
      "
    >
      <div className="mx-auto flex max-w-md flex-col items-center gap-1.5">
        {/* Nombre del Negocio */}
        <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-400">
          {name}
        </h3>

        {/* Info en línea (Flex Wrap) */}
        <div className="flex flex-wrap justify-center items-center gap-x-4 gap-y-1 text-xs font-medium text-neutral-600">
          {address && (
            <div className="flex items-center gap-1.5">
              <MapPinIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{address}</span>
            </div>
          )}

          {address && phone && (
            <span className="hidden text-neutral-300 sm:inline">•</span>
          )}

          {phone && (
            <a
              href={`tel:${phone.replace(/\s/g, "")}`}
              className="flex items-center gap-1.5 transition-colors hover:text-emerald-600 active:scale-95"
            >
              <PhoneIcon className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>{phone}</span>
            </a>
          )}
        </div>

        {/* Copyright mini */}
        <p className="mt-1 text-[10px] text-neutral-600">
          © {year} MikhunAppFood - Todos los derechos reservados.
        </p>
      </div>
    </footer>
  );
};

/* Flecha externa (carrusel) */
const CarouselArrow = React.memo(
  ({ side, disabled, onClick, className = "" }) => (
    <button
      type="button"
      onClick={onClick}
      aria-label={
        side === "left"
          ? "Desplazar a la izquierda"
          : "Desplazar a la derecha"
      }
      className={[
        "pointer-events-auto absolute top-1/2 -translate-y-1/2 z-10",
        side === "left" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2",
        "rounded-full bg-white shadow-lg ring-1 ring-black/10 p-2",
        "transition hover:shadow-xl disabled:opacity-40 disabled:pointer-events-none",
        className,
      ].join(" ")}
      disabled={disabled}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-neutral-800"
      >
        {side === "left" ? (
          <polyline points="15 18 9 12 15 6" />
        ) : (
          <polyline points="9 18 15 12 9 6" />
        )}
      </svg>
    </button>
  )
);

/* Buscador local */
const SearchBar = ({ value, onChange }) => (
  <div className="relative mb-4">
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Buscar combos o categorías…"
      className="
        search-green
        w-full rounded-2xl border border-neutral-200 bg-white/90 px-10 py-3
        text-[14px] text-neutral-800 placeholder:text-neutral-400 shadow-sm
        focus:outline-none
      "
      aria-label="Buscar"
    />
    <svg
      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-3.5-3.5" />
    </svg>
  </div>
);

/* ===== Carrusel de combos (móvil) ===== */
const ComboCarousel = ({ combos, onOpenCombo }) => {
  const ref = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [index, setIndex] = useState(0);
  const [stepPx, setStepPx] = useState(208);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const { scrollLeft, clientWidth, scrollWidth } = el;
    setAtStart(scrollLeft <= 2);
    setAtEnd(scrollLeft + clientWidth >= scrollWidth - 2);
    setIndex(Math.round(scrollLeft / stepPx));
  }, [stepPx]);

  const recalcStep = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const gap = parseFloat(style.gap || "16") || 16;
    const item = el.querySelector(".combo-item");
    const w = (item?.offsetWidth || 280) + gap;
    setStepPx(w);
    updateArrows();
  }, [updateArrows]);

  useEffect(() => {
    recalcStep();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", recalcStep);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", recalcStep);
    };
  }, [combos.length, recalcStep, updateArrows]);

  const go = (dir) =>
    ref.current?.scrollBy({ left: dir * stepPx, behavior: "smooth" });

  if (combos.length === 0) return null;

  return (
    <div className="relative md:hidden animate-fadeInUp">
      {combos.length > 1 && (
        <>
          <CarouselArrow
            side="left"
            disabled={atStart}
            onClick={() => go(-1)}
            className="max-[360px]:hidden"
          />
          <CarouselArrow
            side="right"
            disabled={atEnd}
            onClick={() => go(1)}
            className="max-[360px]:hidden"
          />
        </>
      )}

      <div
        ref={ref}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 px-3 no-scrollbar"
      >
        <div className="shrink-0 w-2" aria-hidden />
        {combos.map((co) => (
          <div
            key={co.id}
            className="
              combo-item shrink-0 snap-start
              min-w-[88%] sm:min-w-[70%] max-[360px]:min-w-[92%]
            "
          >
            <ComboCard
              combo={co}
              onChoose={() => onOpenCombo(co.id)}
              absolute={(u) => u}
              fallbackImg={FALLBACK}
              formatPEN={(n) => `S/ ${Number(n || 0).toFixed(2)}`}
            />
          </div>
        ))}
        <div className="shrink-0 w-2" aria-hidden />
      </div>

      <div className="carousel-gradient-left" />
      <div className="carousel-gradient-right" />

      {combos.length > 1 && (
        <div className="mt-1.5 flex justify-center gap-1.5">
          {combos.map((_, i) => (
            <span
              key={i}
              className={[
                "h-1.5 rounded-full transition-all",
                i === index ? "w-4 bg-neutral-900/80" : "w-2 bg-neutral-300",
              ].join(" ")}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/* Grilla de combos (desktop) */
const ComboGrid = ({ combos, onOpenCombo }) => {
  if (combos.length === 0) return null;
  return (
    <div className="hidden md:grid md:gap-3 lg:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-fadeInUp">
      {combos.map((co) => (
        <CategoryTile
          key={co.id}
          title={co.nombre}
          subtitle={co?.descripcion || "Elige 1 entrada + 1 plato"}
          image={co.cover_url}
          fallback={FALLBACK}
          onClick={() => onOpenCombo(co.id)}
          className="tile-hover"
        />
      ))}
    </div>
  );
};

/* Grilla de categorías */
const CategoryGrid = ({ categories, loading, error, onOpenCategory }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[4/3] animate-pulse rounded-2xl bg-neutral-200"
          />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }
  if (!categories.length) {
    return <EmptyState>No hay categorías disponibles por ahora.</EmptyState>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 animate-fadeInUp">
      {categories.map((c) => (
        <CategoryTile
          key={c.id ?? `cat-${c.nombre}`}
          title={c.nombre}
          subtitle={
            typeof c.items_count === "number"
              ? `${c.items_count} items`
              : Array.isArray(c.items)
              ? `${c.items.length} items`
              : undefined
          }
          image={c.cover_url || FALLBACK}
          fallback={FALLBACK}
          onClick={() => c.id != null && onOpenCategory(c.id)}
          className="tile-hover"
        />
      ))}
    </div>
  );
};

/* Página principal */
export default function Home() {
  const {
    loading,
    error,
    categories = [],
    combos = [],
    mesaId,
    mesaCode,
    restaurantName,
    restaurantCoverUrl,
    restaurantAddress,
    restaurantPhone,
  } = useMenuPublic();

  const nav = useNavigate();

  // Forzar modo claro
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      window.localStorage.removeItem("theme");
    } catch (_) {}
  }, []);

  const mesaText = mesaCode
    ? `#${mesaCode}`
    : mesaId
    ? `#MESA-${mesaId}`
    : "—";

  const qs = useMemo(
    () => window.location.search.replace(/^\?/, "&"),
    [window.location.search]
  );

  const [q, setQ] = useState("");

  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const filteredCombos = useMemo(
    () =>
      q.trim()
        ? combos.filter((x) => norm(x?.nombre).includes(norm(q)))
        : combos,
    [combos, q]
  );

  const filteredCats = useMemo(
    () =>
      q.trim()
        ? categories.filter((x) => norm(x?.nombre).includes(norm(q)))
        : categories,
    [categories, q]
  );

  const openCombo = (id) => nav(`/combo?comboId=${id}${qs}`);
  const openCategory = (id) => nav(`/categoria/${id}${window.location.search}`);

  return (
    <div
      className="
        flex min-h-screen w-full flex-col
        bg-appbg bg-gradient-to-b from-[#fdf5ec] via-[#fdfdfd] to-[#f3f4f6]
        text-neutral-900
      "
      // deja espacio si está activo el CartBar global
      style={{ paddingBottom: "var(--cart-bar-h, 0px)" }}
    >
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-4">
        <RestaurantHeader
          name={restaurantName}
          mesaText={mesaText}
          loading={loading}
          coverUrl={restaurantCoverUrl}
        />

        <SearchBar value={q} onChange={setQ} />

        {(filteredCombos.length > 0 || q.trim().length === 0) && (
          <section aria-labelledby="combos-heading" className="mt-4">
            <SectionTitle id="combos-heading">COMBOS</SectionTitle>
            <ComboCarousel combos={filteredCombos} onOpenCombo={openCombo} />
            <ComboGrid combos={filteredCombos} onOpenCombo={openCombo} />
            <Divider />
          </section>
        )}

        <section aria-labelledby="categories-heading">
          <SectionTitle id="categories-heading">
            EMPIEZA TU PEDIDO AQUÍ
          </SectionTitle>
          <CategoryGrid
            categories={filteredCats}
            loading={loading}
            error={error}
            onOpenCategory={openCategory}
          />
        </section>

        {/* FOOTER COMPACTO */}
        <BusinessFooter
          name={restaurantName}
          address={restaurantAddress}
          phone={restaurantPhone}
        />
      </main>
    </div>
  );
}
