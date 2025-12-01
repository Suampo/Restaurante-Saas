// src/components/ProductSheet.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG } from "../lib/ui";
import { X, Minus, Plus, ChefHat, ShoppingBag, Sparkles } from "lucide-react";

/* ================= helpers ================= */
const currency = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

const norm = (s = "") =>
  String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const catIdOf = (m) =>
  m?.categoria_id ??
  m?.categoriaId ??
  m?.category_id ??
  m?.categoryId ??
  m?.categoria?.id ??
  m?.category?.id ??
  null;

const MATCH = {
  extras: ["extra", "adicional", "topping", "agregado"],
  acomp: ["acompan", "acompa", "acomp", "acompanam", "guarn", "side"],
  drinks: ["bebida", "gaseosa", "refresco", "drink"],
};

/**
 * Proxifica imágenes a través de tu backend /img para:
 *  - Redimensionar (menos KB y menos decode)
 *  - Mantener WebP/AVIF donde se pueda
 */
const buildSheetImg = (apiBase, url, { w = 640, h = 400 } = {}) => {
  if (!url) return FALLBACK_IMG;
  try {
    const base = (apiBase || "").replace(/\/$/, "");
    // si ya es /img, no lo tocamos
    if (url.includes("/img?")) return url;
    const encoded = encodeURIComponent(url);
    return `${base}/img?url=${encoded}&w=${w}&h=${h}&fit=cover`;
  } catch {
    return url;
  }
};

/* ================ subcomponentes ================ */

const QuantitySelector = React.memo(function QuantitySelector({
  quantity,
  setQuantity,
  min = 1,
  max = 99,
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-neutral-50 to-neutral-100 p-1 shadow-sm ring-1 ring-black/5">
      <button
        type="button"
        onClick={() => setQuantity((q) => Math.max(min, q - 1))}
        disabled={quantity <= min}
        className="grid h-9 w-9 place-items-center rounded-full bg-white text-neutral-700 shadow-sm transition-all hover:scale-105 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        aria-label="Disminuir cantidad"
      >
        <Minus className="h-4 w-4" />
      </button>
      <div
        className="min-w-[2rem] text-center font-bold tabular-nums text-neutral-900"
        aria-live="polite"
      >
        {quantity}
      </div>
      <button
        type="button"
        onClick={() => setQuantity((q) => Math.min(max, q + 1))}
        disabled={quantity >= max}
        className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
        aria-label="Aumentar cantidad"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
});

const OptionItem = React.memo(function OptionItem({
  option,
  count,
  groupKey,
  groupCount,
  max,
  onChange,
}) {
  const atMax = groupCount >= max;

  return (
    <li className="group relative flex items-center gap-3 p-3 transition-colors hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-transparent">
      {count > 0 && (
        <div className="absolute -left-1 -top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-emerald-600 to-emerald-700 text-[10px] font-bold text-white shadow-lg shadow-emerald-500/40 ring-2 ring-white">
          {count}
        </div>
      )}

      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-neutral-100 to-neutral-50 shadow-sm ring-1 ring-black/5 transition-all group-hover:scale-105 group-hover:shadow-md">
        {option.image ? (
          <img
            src={option.image}
            alt={option.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <ChefHat className="h-5 w-5 text-neutral-300" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="break-words text-sm font-semibold leading-snug text-neutral-900">
          {option.name}
        </div>
        <div className="mt-0.5 flex items-center gap-1 text-emerald-700">
          <Plus className="h-3 w-3" />
          <span className="text-xs font-semibold">{currency(option.price)}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(groupKey, option.id, -1)}
          disabled={count === 0}
          className="grid h-8 w-8 place-items-center rounded-lg border-2 border-neutral-200 text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:scale-105 disabled:opacity-30 disabled:hover:scale-100"
          aria-label={`Quitar ${option.name}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onChange(groupKey, option.id, 1)}
          disabled={atMax}
          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-500/30 transition-all hover:scale-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
          aria-label={`Agregar ${option.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
});

/* ================= principal ================= */
export default function ProductSheet({ open, item, onClose }) {
  const ctx = useMenuPublic() || {};
  const { apiBase, categories = [], ...providerMenuLists } = ctx;

  const overlayRef = useRef(null);
  const closeBtnRef = useRef(null);
  const mainRef = useRef(null);
  const headingId = useMemo(
    () => `psh-title-${item?.id ?? "x"}`,
    [item?.id]
  );

  // Helper de imagen con tamaño según uso
  const imgHeader = useCallback(
    (url) => buildSheetImg(apiBase, url, { w: 640, h: 400 }),
    [apiBase]
  );
  const imgOption = useCallback(
    (url) => buildSheetImg(apiBase, url, { w: 220, h: 220 }),
    [apiBase]
  );

  // 1) Consolidar lista global de items del menú (solo se recalcula si cambia el context)
  const fullList = useMemo(() => {
    const candidates = [
      providerMenuLists.menuAll,
      providerMenuLists.allMenu,
      providerMenuLists.fullMenu,
      providerMenuLists.menuItems,
      providerMenuLists.items,
      providerMenuLists.menu,
    ];
    for (const a of candidates) if (Array.isArray(a) && a.length) return a;

    if (Array.isArray(categories) && categories.length) {
      return categories.flatMap((c) =>
        (c?.items || []).map((m) => ({
          ...m,
          categoria_id: catIdOf(m) ?? c?.id ?? null,
        }))
      );
    }
    return [];
  }, [providerMenuLists, categories]);

  // 2) Buscar categorías por nombre
  const catIdsByKey = useMemo(() => {
    const out = { extras: [], acomp: [], drinks: [] };
    if (!Array.isArray(categories) || !categories.length) return out;

    const findIds = (keys) =>
      categories
        .filter((c) =>
          keys.some((k) => norm(c?.nombre || c?.name).includes(k))
        )
        .map((c) => c.id);

    out.extras = findIds(MATCH.extras);
    out.acomp = findIds(MATCH.acomp);
    out.drinks = findIds(MATCH.drinks);
    return out;
  }, [categories]);

  // 3) Grupos de opciones (extras, acompañamientos, bebidas)
  const grupos = useMemo(() => {
    const toOpt = (x) => ({
      id: x.id,
      name: x?.nombre || "",
      price: Number(x.precio || 0),
      image: x.imagen_url ? imgOption(x.imagen_url) : null,
    });

    const fromCatIds = (ids) =>
      fullList
        .filter((m) => ids.includes(catIdOf(m)) && m?.activo !== false)
        .map(toOpt);

    const out = [];
    const extras = fromCatIds(catIdsByKey.extras);
    const acomp = fromCatIds(catIdsByKey.acomp);
    const drinks = fromCatIds(catIdsByKey.drinks);

    if (extras.length)
      out.push({
        key: "extras",
        title: "Elige tus Toppings Extras",
        icon: Sparkles,
        max: 10,
        items: extras,
      });
    if (acomp.length)
      out.push({
        key: "acomps",
        title: "Acompañamientos",
        icon: ChefHat,
        max: 10,
        items: acomp,
      });
    if (drinks.length)
      out.push({
        key: "drinks",
        title: "Bebidas",
        icon: ShoppingBag,
        max: 10,
        items: drinks,
      });
    return out;
  }, [fullList, catIdsByKey, imgOption]);

  // 4) Estados
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState({});

  const basePrice = Number(item?.precio || 0);

  // Mapa id -> precio (solo cuando cambian los grupos)
  const priceMap = useMemo(() => {
    const m = new Map();
    grupos.forEach((g) =>
      g.items.forEach((i) => {
        m.set(Number(i.id), i.price);
      })
    );
    return m;
  }, [grupos]);

  const extrasTotal = useMemo(
    () =>
      Object.entries(selected).reduce((sum, [id, count]) => {
        const p = priceMap.get(Number(id)) || 0;
        return sum + p * count;
      }, 0),
    [selected, priceMap]
  );

  const total = useMemo(
    () => basePrice * qty + extrasTotal,
    [basePrice, qty, extrasTotal]
  );

  const handleToggleAdd = useCallback(
    (groupKey, itemId, delta) => {
      setSelected((prev) => {
        const group = grupos.find((g) => g.key === groupKey);
        if (!group) return prev;

        const currentGroupTotal = group.items.reduce(
          (t, it) => t + (prev[it.id] || 0),
          0
        );
        if (delta > 0 && currentGroupTotal >= group.max) {
          return prev;
        }

        const prevCount = prev[itemId] || 0;
        const nextCount = Math.max(0, prevCount + delta);
        if (nextCount === prevCount) return prev;

        const next = { ...prev };
        if (nextCount === 0) delete next[itemId];
        else next[itemId] = nextCount;
        return next;
      });
    },
    [grupos]
  );

  const addToCart = () => {
    for (let i = 0; i < qty; i++) {
      window.dispatchEvent(
        new CustomEvent("cart:add", { detail: { item: { ...item } } })
      );
    }

    const allOptions = grupos.flatMap((g) => g.items);
    Object.entries(selected).forEach(([id, count]) => {
      const option = allOptions.find((x) => x.id === Number(id));
      if (!option || count <= 0) return;
      const extraItem = {
        id: option.id,
        nombre: option.name,
        precio: option.price,
        imagen_url: null,
      };
      for (let i = 0; i < count; i++) {
        window.dispatchEvent(
          new CustomEvent("cart:add", { detail: { item: extraItem } })
        );
      }
    });

    if (note?.trim()) window.__CHECKOUT_NOTE__ = String(note).slice(0, 300);
    onClose?.();
  };

  /* ===== Scroll-lock ===== */
  useEffect(() => {
    if (!open) return;
    const { style: bs } = document.body;
    const { style: rs } = document.documentElement;
    const prevOverflow = bs.overflow;
    const prevPadding = bs.paddingRight;
    const prevOB = rs.overscrollBehavior;

    const sw = window.innerWidth - document.documentElement.clientWidth;
    bs.overflow = "hidden";
    if (sw > 0) bs.paddingRight = `${sw}px`;
    rs.overscrollBehavior = "contain";

    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);

    overlayRef.current?.focus();
    closeBtnRef.current?.focus({ preventScroll: true });

    return () => {
      bs.overflow = prevOverflow;
      bs.paddingRight = prevPadding;
      rs.overscrollBehavior = prevOB;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Reset + scroll top
  useEffect(() => {
    if (open) {
      setQty(1);
      setNote("");
      setSelected({});
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
  }, [open, item]);

  if (!open || !item) return null;

  const imgSrc = item.imagen_url ? imgHeader(item.imagen_url) : FALLBACK_IMG;

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 backdrop-blur-none md:backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby={headingId}
      onClick={onClose}
      style={{
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 0,
        paddingRight: 0,
      }}
    >
      {/* Wrapper: altura fija 642px en móvil; en desktop 85vh */}
      <div
        className="
          grid w-full max-w-full bg-white overflow-hidden
          sm:max-w-[440px]
          rounded-none sm:rounded-3xl
          shadow-2xl ring-1 ring-black/10
          h-[min(642px,calc(100svh-24px))] sm:h-[85vh]
        "
        style={{ gridTemplateRows: "auto 1fr auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800">
          <div className="absolute inset-0 opacity-20">
            <img
              src={imgSrc}
              loading="lazy"
              decoding="async"
              onError={(e) => (e.currentTarget.style.display = "none")}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/50 to-transparent" />
          </div>

          <div className="relative px-4 py-4">
            <div className="flex items-start gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-white shadow-lg ring-2 ring-white/30">
                <img
                  src={imgSrc}
                  onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
                  alt={item.nombre}
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <h1
                  id={headingId}
                  className="mb-1.5 line-clamp-2 text-base font-bold tracking-tight text-white drop-shadow-md"
                >
                  {item.nombre}
                </h1>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 backdrop-blur-sm">
                  <ChefHat className="h-3 w-3 text-white/90" />
                  <span className="text-[11px] font-semibold text-white/90">
                    Restaurante
                  </span>
                </div>
              </div>

              <button
                ref={closeBtnRef}
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-white backdrop-blur-md transition-all hover:scale-105 hover:bg-white/30"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Contenido con scroll */}
        <main
          ref={mainRef}
          className="overflow-y-auto overflow-x-hidden bg-gradient-to-b from-neutral-50 to-white px-4 py-4"
          style={{ minHeight: 0 }}
        >
          {/* Precio base */}
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100/50 p-3 ring-1 ring-emerald-200/50">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-gradient-to-br from-emerald-600 to-emerald-700 shadow-md shadow-emerald-500/30">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Precio base
              </div>
              <div className="text-lg font-bold text-emerald-900">
                {currency(basePrice)}
              </div>
            </div>
          </div>

          {/* Descripción */}
          {item.descripcion && (
            <p className="mb-5 text-sm leading-relaxed text-neutral-600">
              {item.descripcion}
            </p>
          )}

          {/* Grupos */}
          {grupos.length > 0 && (
            <div className="space-y-5">
              {grupos.map((g) => {
                const currentGroupTotal = g.items.reduce(
                  (t, it) => t + (selected[it.id] || 0),
                  0
                );
                const Icon = g.icon;
                return (
                  <section key={g.key}>
                    <div className="mb-3 flex items-center gap-2.5">
                      <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-neutral-100 to-neutral-50 ring-1 ring-black/5">
                        <Icon className="h-4 w-4 text-neutral-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-bold text-neutral-900">
                          {g.title}
                        </h2>
                        <p className="text-[11px] text-neutral-500">
                          Hasta {g.max} · {currentGroupTotal}/{g.max}{" "}
                          seleccionadas
                        </p>
                      </div>
                    </div>
                    <ul className="overflow-hidden rounded-xl border border-neutral-200/70 bg-white shadow-sm divide-y divide-neutral-100">
                      {g.items.map((opt) => (
                        <OptionItem
                          key={`${g.key}-${opt.id}`}
                          option={opt}
                          count={selected[opt.id] || 0}
                          groupKey={g.key}
                          groupCount={currentGroupTotal}
                          max={g.max}
                          onChange={handleToggleAdd}
                        />
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}

          {/* Nota */}
          <section className="mt-5 mb-4">
            <h2 className="mb-2.5 text-sm font-bold text-neutral-900">
              Comentarios Adicionales
            </h2>
            <div className="relative">
              <textarea
                rows={3}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="¿Alguna instrucción especial?"
                className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 shadow-sm outline-none ring-0 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200/50"
              />
              <div className="absolute bottom-2 right-2 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500">
                {note.length}/300
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-200 bg-white px-4 py-3">
          <div className="flex flex-col gap-3">
            <QuantitySelector quantity={qty} setQuantity={setQty} />
            <button
              type="button"
              onClick={addToCart}
              className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/30 transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
              aria-label="Agregar al carrito"
            >
              <ShoppingBag className="h-4 w-4" />
              <span>Agregar · {currency(total)}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
