// src/components/CartSheet.jsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute as makeAbs } from "../lib/ui";

/* ========= helpers ========= */
const norm = (s = "") =>
  String(s).normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

const KEYWORDS = {
  extras: ["extra", "adicional", "topping", "agregado"],
  acomp: ["acompan", "acompa", "acomp", "guarn", "side"],
  drinks: ["bebida", "gaseosa", "refresco", "drink"],
};

const MAX_SUGGESTIONS_PER_GROUP = 8; // PERF: no traer 100 extras en mobile

function resolveImgSrc(absolute, item, fallbackImg) {
  const candidates = [
    item?.imagen_url_abs,
    item?.imagen_url,
    item?.imagen,
    item?.image_url,
    item?.image,
    item?.foto_url,
    item?.foto,
  ].filter(Boolean);

  for (const c of candidates) {
    const s = String(c);
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    const abs = absolute(s);
    if (abs) return abs;
  }
  return fallbackImg;
}

/* iconito de carrito */
const CartIcon = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
    {...p}
  >
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 3h2l2.2 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" />
  </svg>
);

function CartSheetInner({
  open,
  onClose,
  cart,
  total,
  formatPEN,
  absolute: absProp,
  fallbackImg = FALLBACK_IMG,
  onAdd, // (index)
  onRemove, // (index)
  onPay,
}) {
  // formateador seguro
  const fmt = useCallback(
    (value) =>
      formatPEN
        ? formatPEN(value)
        : `S/ ${Number(value || 0).toFixed(2)}`,
    [formatPEN]
  );

  /* ===== contexto (sugerencias) ===== */
  const { categories = [], menuAll: menuCtxAll, apiBase } = useMenuPublic();
  const absolute = useCallback(
    absProp || ((u) => makeAbs(apiBase, u)),
    [absProp, apiBase]
  );

  const globalMenu = useMemo(() => {
    if (Array.isArray(menuCtxAll) && menuCtxAll.length) return menuCtxAll;
    const flat = [];
    for (const c of categories) {
      const arr = Array.isArray(c?.items) ? c.items : [];
      for (const m of arr) {
        flat.push({ ...m, categoria_id: m?.categoria_id ?? c?.id ?? null });
      }
    }
    return flat;
  }, [menuCtxAll, categories]);

  const catIdsByKey = useMemo(() => {
    const out = { extras: new Set(), acomp: new Set(), drinks: new Set() };
    for (const c of categories) {
      const nm = norm(c?.nombre || "");
      if (KEYWORDS.extras.some((k) => nm.includes(k))) out.extras.add(c.id);
      if (KEYWORDS.acomp.some((k) => nm.includes(k))) out.acomp.add(c.id);
      if (KEYWORDS.drinks.some((k) => nm.includes(k))) out.drinks.add(c.id);
    }
    return out;
  }, [categories]);

  const suggestGroups = useMemo(() => {
    const toOpt = (x) => ({
      id: x.id,
      name: x.nombre,
      price: Number(x.precio || 0),
      rawImage: x.imagen_url || x.imagen || x.image || x.foto_url || null,
      imageAbs:
        x.imagen_url || x.imagen || x.image || x.foto_url
          ? absolute(x.imagen_url || x.imagen || x.image || x.foto_url)
          : null,
    });

    const pick = (idSet) =>
      globalMenu
        .filter((m) => idSet.has(m?.categoria_id) && m?.activo !== false)
        .slice(0, MAX_SUGGESTIONS_PER_GROUP)
        .map(toOpt);

    const extras = pick(catIdsByKey.extras);
    const acomp = pick(catIdsByKey.acomp);
    const drinks = pick(catIdsByKey.drinks);

    const out = [];
    if (extras.length)
      out.push({
        key: "extras",
        title: "Toppings extra para ti",
        items: extras,
      });
    if (acomp.length)
      out.push({
        key: "acomps",
        title: "Acompañamientos recomendados",
        items: acomp,
      });
    if (drinks.length)
      out.push({
        key: "drinks",
        title: "Bebidas para tu pedido",
        items: drinks,
      });
    return out;
  }, [globalMenu, catIdsByKey, absolute]);

  const addSuggestion = useCallback((opt) => {
    window.dispatchEvent(
      new CustomEvent("cart:add", {
        detail: {
          item: {
            id: opt.id,
            nombre: opt.name,
            precio: opt.price,
            imagen_url: opt.rawImage || null,
            imagen_url_abs: opt.imageAbs || null,
          },
        },
      })
    );
  }, []);

  /* ===== estado / animaciones ===== */
  const [visible, setVisible] = useState(open);
  const [state, setState] = useState(open ? "open" : "closed");
  const panelRef = useRef(null);
  const startY = useRef(0);
  const deltaY = useRef(0);
  const dragging = useRef(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // abrir/cerrar + bloquear scroll body
  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setState("open"));
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const onKey = (e) => {
        if (e.key === "Escape") onCloseRef.current?.();
      };
      window.addEventListener("keydown", onKey);

      return () => {
        document.body.style.overflow = prev;
        window.removeEventListener("keydown", onKey);
      };
    } else if (visible) {
      setState("closing");
      const t = setTimeout(() => {
        setState("closed");
        setVisible(false);
      }, 220);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current || !panelRef.current) return;
    const clientY =
      e.clientY ??
      (e.touches && e.touches[0] && e.touches[0].clientY) ??
      0;
    deltaY.current = Math.max(0, clientY - startY.current);
    const damp =
      deltaY.current < 80
        ? deltaY.current
        : 80 + (deltaY.current - 80) * 0.4;
    panelRef.current.style.transform = `translateY(${damp}px)`;
    if (e.cancelable) e.preventDefault();
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldClose = deltaY.current > 120;

    if (panelRef.current) {
      panelRef.current.style.transition = "";
      panelRef.current.style.removeProperty("transform");
    }

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);

    if (shouldClose) onCloseRef.current?.();
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e) => {
      dragging.current = true;
      const clientY =
        e.clientY ??
        (e.touches && e.touches[0] && e.touches[0].clientY) ??
        0;
      startY.current = clientY;
      deltaY.current = 0;
      if (panelRef.current) {
        panelRef.current.style.transition = "none";
        panelRef.current.style.transform = "translateY(0px)";
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    },
    [onPointerMove, onPointerUp]
  );

  // Limpieza por si se desmonta en medio del drag
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  if (!visible) return null;
  const hasItems = Array.isArray(cart) && cart.length > 0;

  /* ===== mínimo de compra (opcional) ===== */
  const MIN_SUBTOTAL = Number(import.meta.env.VITE_MIN_SUBTOTAL || 0);
  const reachedMin = Number(total || 0) >= MIN_SUBTOTAL;
  const missing = Math.max(0, MIN_SUBTOTAL - Number(total || 0));

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-title"
    >
      {/* overlay (sin blur en mobile) */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-none md:backdrop-blur-[2px] transition-opacity"
        data-state={state === "open" ? "open" : "closed"}
        onClick={onClose}
      />

      {/* panel */}
      <div
        ref={panelRef}
        className="
          absolute bottom-0 left-0 right-0 mx-auto w-full max-w-6xl
          md:bottom-auto md:top-0 md:right-0 md:left-auto md:h-full md:max-w-md
          flex h-[92svh] flex-col
          rounded-t-[32px] md:rounded-l-[32px] md:rounded-t-none
          bg-[#fffdf8] md:bg-[#fffdf8]/95
          backdrop-blur-none md:backdrop-blur-xl
          shadow-[0_8px_24px_rgba(15,23,42,.35)] md:shadow-[0_16px_55px_rgba(15,23,42,.45)]
          ring-1 ring-black/5
          will-change-transform
        "
        data-state={state}
      >
        {/* header */}
        <div className="relative border-b border-black/5 md:border-0 shrink-0 md:pt-2">
          <div className="absolute left-1/2 top-2 -translate-x-1/2 md:hidden">
            <span
              onPointerDown={onPointerDown}
              className="block h-1.5 w-10 rounded-full bg-neutral-300"
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center justify-between px-5 py-3 md:border-b md:border-black/5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-500 text-white shadow-[0_8px_20px_rgba(16,185,129,.45)]">
                <CartIcon className="h-5 w-5" />
              </div>
              <div>
                <h3
                  id="cart-title"
                  className="text-sm font-semibold text-neutral-900 tracking-tight"
                >
                  Tu carrito
                </h3>
                <p className="text-[11px] text-neutral-500">
                  {hasItems
                    ? `${cart.length} ${
                        cart.length === 1 ? "ítem" : "ítems"
                      } seleccionados`
                    : "Aún no has agregado productos"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 active:scale-95 transition"
              aria-label="Cerrar carrito"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* contenido scrollable */}
        <div className="min-h-0 grow overflow-y-auto px-4 py-4">
          {hasItems ? (
            <div className="space-y-4">
              {/* bloque principal */}
              <div className="rounded-[24px] bg-white/90 p-3 ring-1 ring-black/5 shadow-sm md:shadow-[0_10px_35px_rgba(15,23,42,.08)]">
                {/* lista ítems */}
                <ul className="space-y-3">
                  {cart.map((item, idx) => {
                    const unit = Number(item?.precio || 0);
                    const qty = Number(item?.cantidad || 1);
                    const lineTotal = unit * qty;
                    const comboImg =
                      item?.entrada?.imagen_url ||
                      item?.entrada?.imagen ||
                      item?.plato?.imagen_url ||
                      item?.plato?.imagen;
                    const imgSrc = resolveImgSrc(
                      absolute,
                      item.isCombo ? { imagen_url: comboImg } : item,
                      fallbackImg
                    );
                    const unitLabel = fmt(unit);
                    const lineTotalLabel = fmt(lineTotal);

                    return (
                      <li
                        key={`cart-${idx}-${item.isCombo ? "combo" : "item"}`}
                        className="
                          group relative flex items-center gap-3 rounded-3xl
                          bg-white px-3.5 py-3
                          ring-1 ring-neutral-200 shadow-sm
                          md:shadow-[0_10px_30px_rgba(15,23,42,.14)]
                          md:hover:shadow-[0_16px_40px_rgba(15,23,42,.20)]
                          md:hover:-translate-y-[1px]
                          transition-transform duration-150
                        "
                      >
                        {/* Imagen */}
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5">
                          <img
                            src={imgSrc}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = fallbackImg;
                            }}
                            alt={
                              item.isCombo ? item?.nombreCombo : item?.nombre
                            }
                            className="h-full w-full object-cover"
                          />
                        </div>

                        {/* Texto */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {item.isCombo && (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200/70">
                                Combo
                              </span>
                            )}
                            <p className="truncate text-[13px] font-semibold text-neutral-900">
                              {item.isCombo ? item?.nombreCombo : item?.nombre}
                            </p>
                          </div>

                          <p className="mt-0.5 line-clamp-1 text-[11px] text-neutral-500">
                            {item.isCombo
                              ? `${item?.entrada?.nombre || "Entrada"} + ${
                                  item?.plato?.nombre || "Plato principal"
                                }`
                              : item?.descripcion || "Sin descripción"}
                          </p>

                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-500">
                            <span>
                              {qty} × {unitLabel}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-neutral-300" />
                            <span className="font-semibold text-neutral-900">
                              {lineTotalLabel}
                            </span>
                          </div>
                        </div>

                        {/* Total + controles */}
                        <div className="flex flex-col items-end justify-between gap-2 self-stretch">
                          {/* total en pastilla */}
                          <div className="inline-flex items-center rounded-full bg-neutral-900 px-3 py-1 text-[11px] font-semibold tracking-tight text-white shadow-md shadow-neutral-900/30">
                            {lineTotalLabel}
                          </div>

                          {/* control de cantidad */}
                          <div className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-1.5 py-1 ring-1 ring-neutral-200">
                            <button
                              type="button"
                              onClick={() => onRemove(idx)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-white text-neutral-700 shadow-sm hover:bg-neutral-50 active:scale-95 transition"
                              aria-label={`Quitar uno de ${
                                item.isCombo
                                  ? item?.nombreCombo
                                  : item?.nombre
                              }`}
                              title="Quitar uno"
                            >
                              <span className="text-base leading-none">−</span>
                            </button>
                            <span className="min-w-[1.5rem] text-center text-[11px] font-semibold text-neutral-800">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => onAdd(idx)}
                              className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-t from-emerald-600 to-emerald-500 text-white shadow-sm shadow-emerald-500/40 hover:from-emerald-500 hover:to-emerald-400 active:scale-95 transition"
                              aria-label={`Agregar uno de ${
                                item.isCombo
                                  ? item?.nombreCombo
                                  : item?.nombre
                              }`}
                              title="Agregar uno"
                            >
                              <span className="text-base leading-none">+</span>
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* mínimo de compra */}
                {MIN_SUBTOTAL > 0 && (
                  <div
                    className={`mt-4 rounded-2xl px-4 py-3 text-[12px] ${
                      reachedMin
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {reachedMin ? (
                      <>¡Has completado el mínimo de compra!</>
                    ) : (
                      <>
                        Te faltan{" "}
                        <b className="font-semibold">
                          {fmt(missing)}
                        </b>{" "}
                        para el mínimo de compra.
                      </>
                    )}
                  </div>
                )}

                {/* complementa tu pedido */}
                {suggestGroups.length > 0 && (
                  <section className="mt-5">
                    <h4 className="mb-2 text-[13px] font-semibold tracking-wide text-neutral-900">
                      Complementa tu pedido
                    </h4>

                    <div className="space-y-5">
                      {suggestGroups.map((g) => (
                        <div key={g.key}>
                          <div className="mb-2 text-[12px] text-neutral-600">
                            {g.title}
                          </div>
                          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                            {g.items.map((opt) => (
                              <article
                                key={opt.id}
                                className="relative w-[170px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
                              >
                                <div className="relative">
                                  {opt.imageAbs ? (
                                    <img
                                      src={opt.imageAbs}
                                      alt={opt.name}
                                      className="h-24 w-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <div className="grid h-24 place-items-center bg-neutral-100 text-xs text-neutral-500">
                                      Sin imagen
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => addSuggestion(opt)}
                                    aria-label="Agregar"
                                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-emerald-600 text-white shadow-md hover:bg-emerald-500"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="p-2.5">
                                  <div className="line-clamp-2 text-[13px] font-medium text-neutral-900">
                                    {opt.name}
                                  </div>
                                  <div className="mt-0.5 text-[12px] text-neutral-600">
                                    {fmt(opt.price)}
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </div>
          ) : (
            // vacío
            <div className="grid place-items-center px-5 py-10">
              <div className="w-full max-w-sm text-center">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-100 ring-1 ring-black/5">
                  <span className="text-xl">🛒</span>
                </div>
                <h4 className="text-base font-semibold text-neutral-900">
                  Tu carrito está vacío
                </h4>
                <p className="mt-1 text-sm text-neutral-600">
                  Agrega platos para continuar con tu pedido.
                </p>
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border px-4 py-2 text-sm text-neutral-900 shadow-sm hover:bg-neutral-50"
                  >
                    Ver carta
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* footer sticky */}
        <div className="sticky bottom-0 z-10 border-t border-neutral-100 bg-gradient-to-t from-white via-white/95 to-white/90 backdrop-blur-none md:backdrop-blur-sm px-4 py-3 sm:py-4 shrink-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Subtotal */}
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Subtotal{" "}
                <span className="font-normal lowercase text-neutral-400">
                  (sin envío)
                </span>
              </span>
              <span className="mt-0.5 text-2xl font-extrabold leading-none tracking-tight text-neutral-900">
                {fmt(total)}
              </span>
            </div>

            {/* Botón acción */}
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                onClick={onPay}
                disabled={!hasItems || (MIN_SUBTOTAL > 0 && !reachedMin)}
                className={`
                  group inline-flex items-center justify-center rounded-full px-7 py-3 text-sm font-semibold text-white
                  transition-all duration-200
                  ${
                    !hasItems || (MIN_SUBTOTAL > 0 && !reachedMin)
                      ? "bg-emerald-300 cursor-not-allowed opacity-70 shadow-none"
                      : "bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-[0_10px_26px_rgba(16,185,129,0.45)] hover:translate-y-[1px] hover:shadow-[0_14px_34px_rgba(16,185,129,0.55)] active:translate-y-[2px]"
                  }
                `}
              >
                <span className="mr-2">Pagar pedido</span>
                <svg
                  className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    d="M5 12h14M13 6l6 6-6 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {MIN_SUBTOTAL > 0 && !reachedMin && (
                <p className="text-[11px] text-neutral-500">
                  Te faltan{" "}
                    <span className="font-semibold text-neutral-800">
                      {fmt(missing)}
                    </span>{" "}
                  para completar el mínimo.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memo para evitar renders innecesarios si las props no cambian
export default React.memo(CartSheetInner);
