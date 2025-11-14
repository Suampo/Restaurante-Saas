// src/components/CartSheet.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

const currency = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

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

/* iconito de carrito (inline, sin dependencias) */
const CartIcon = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <circle cx="9" cy="20" r="1.5" />
    <circle cx="18" cy="20" r="1.5" />
    <path d="M3 3h2l2.2 12.4a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 8H7" />
  </svg>
);

export default function CartSheet({
  open,
  onClose,
  cart,
  total,
  formatPEN,
  absolute: absProp,
  fallbackImg = FALLBACK_IMG,
  onAdd,     // (index)
  onRemove,  // (index)
  onPay,
}) {
  /* ===== contexto (sugerencias) ===== */
  const { categories = [], menuAll: menuCtxAll, apiBase } = useMenuPublic();
  const absolute = absProp || ((u) => makeAbs(apiBase, u));

  const globalMenu = useMemo(() => {
    if (Array.isArray(menuCtxAll) && menuCtxAll.length) return menuCtxAll;
    const flat = [];
    for (const c of categories) {
      const arr = Array.isArray(c?.items) ? c.items : [];
      for (const m of arr) flat.push({ ...m, categoria_id: m?.categoria_id ?? c?.id ?? null });
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
        .map(toOpt);

    const extras = pick(catIdsByKey.extras);
    const acomp = pick(catIdsByKey.acomp);
    const drinks = pick(catIdsByKey.drinks);

    const out = [];
    if (extras.length) out.push({ key: "extras", title: "Toppings extra para ti", items: extras });
    if (acomp.length) out.push({ key: "acomps", title: "Acompañamientos recomendados", items: acomp });
    if (drinks.length) out.push({ key: "drinks", title: "Bebidas para tu pedido", items: drinks });
    return out;
  }, [globalMenu, catIdsByKey, absolute]);

  const addSuggestion = (opt) => {
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
  };

  /* ===== estado / animaciones ===== */
  const [visible, setVisible] = useState(open);
  const [state, setState] = useState(open ? "open" : "closed");
  const panelRef = useRef(null);
  const startY = useRef(0);
  const deltaY = useRef(0);
  const dragging = useRef(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setState("open"));
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    } else if (visible) {
      setState("closing");
      const t = setTimeout(() => {
        setState("closed");
        setVisible(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [open]); // eslint-disable-line

  if (!visible) return null;
  const hasItems = Array.isArray(cart) && cart.length > 0;

  const onPointerDown = (e) => {
    dragging.current = true;
    startY.current = e.clientY || e.touches?.[0]?.clientY || 0;
    deltaY.current = 0;
    if (panelRef.current) {
      panelRef.current.style.transition = "none";
      panelRef.current.style.transform = "translateY(0px)";
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp);
  };
  const onPointerMove = (e) => {
    if (!dragging.current || !panelRef.current) return;
    const current = e.clientY || e.touches?.[0]?.clientY || 0;
    deltaY.current = Math.max(0, current - startY.current);
    const damp = deltaY.current < 80 ? deltaY.current : 80 + (deltaY.current - 80) * 0.4;
    panelRef.current.style.transform = `translateY(${damp}px)`;
    if (e.cancelable) e.preventDefault();
  };
  const onPointerUp = () => {
    if (!dragging.current) return;
    dragging.current = false;
    const shouldClose = deltaY.current > 120;
    if (panelRef.current) {
      panelRef.current.style.transition = "";
      panelRef.current.style.removeProperty("transform");
    }
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);
    if (shouldClose) onClose?.();
  };

  /* ===== mínimo de compra (opcional) ===== */
  const MIN_SUBTOTAL = Number(import.meta.env.VITE_MIN_SUBTOTAL || 0);
  const reachedMin = Number(total || 0) >= MIN_SUBTOTAL;
  const missing = Math.max(0, MIN_SUBTOTAL - Number(total || 0));

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="cart-title">
      {/* overlay */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity"
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
          rounded-t-3xl md:rounded-l-3xl md:rounded-t-none
          bg-white/92 backdrop-blur-xl shadow-[0_15px_50px_-10px_rgba(0,0,0,.35)] ring-1 ring-black/5
        "
        data-state={state}
      >
        {/* header */}
        <div className="relative border-b border-black/5 md:border-0 md:pt-2 shrink-0">
          <div className="absolute left-1/2 top-2 -translate-x-1/2 md:hidden">
            <span
              onPointerDown={onPointerDown}
              onTouchStart={onPointerDown}
              className="block h-1.5 w-10 rounded-full bg-neutral-300"
              aria-hidden="true"
            />
          </div>

          <div className="flex items-center justify-between px-5 py-3 md:border-b md:border-black/5">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200">
                <CartIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 id="cart-title" className="text-base font-semibold text-neutral-900">Tu carrito</h3>
                <p className="text-xs text-neutral-500">
                  {hasItems ? `${cart.length} ${cart.length === 1 ? "ítem" : "ítems"}` : "Sin productos"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-1.5 text-sm text-neutral-900 shadow-sm hover:bg-neutral-50"
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
              {/* bloque rosado */}
              <div className="rounded-3xl bg-rose-50/70 p-3 ring-1 ring-rose-100 shadow-sm">
                {/* lista ítems */}
                <ul className="space-y-3">
                  {cart.map((item, idx) => {
                    const unit = Number(item?.precio || 0);
                    const lineTotal = unit * Number(item?.cantidad || 1);
                    const comboImg =
                      item?.entrada?.imagen_url || item?.entrada?.imagen || item?.plato?.imagen_url || item?.plato?.imagen;
                    const imgSrc = resolveImgSrc(
                      absolute,
                      item.isCombo ? { imagen_url: comboImg } : item,
                      fallbackImg
                    );

                    return (
                      <li
                        key={`cart-${idx}-${item.isCombo ? "combo" : "item"}`}
                        className="group flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-black/5 hover:shadow-md transition"
                      >
                        <img
                          src={imgSrc}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallbackImg;
                          }}
                          alt={item.isCombo ? item?.nombreCombo : item?.nombre}
                          className="h-14 w-14 rounded-xl object-cover ring-1 ring-black/5"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {item.isCombo && (
                              <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-300/60">
                                Combo
                              </span>
                            )}
                            <p className="truncate font-medium text-neutral-900">
                              {item.isCombo ? item?.nombreCombo : item?.nombre}
                            </p>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
                            {item.isCombo
                              ? `${item?.entrada?.nombre || "Entrada"} + ${item?.plato?.nombre || "Plato"}`
                              : item?.descripcion || "Sin descripción"}
                          </p>

                          <div className="mt-1 text-[13px] text-neutral-700">
                            {item?.cantidad} × {formatPEN(unit)}{" "}
                            <span className="mx-1 opacity-40">•</span>
                            <span className="font-semibold text-neutral-900">{formatPEN(lineTotal)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onRemove(idx)}
                            className="h-9 w-9 rounded-lg border text-neutral-900 hover:bg-neutral-100 active:scale-[.98] transition"
                            aria-label={`Quitar uno de ${item.isCombo ? item?.nombreCombo : item?.nombre}`}
                            title="Quitar uno"
                          >
                            −
                          </button>
                          <button
                            onClick={() => onAdd(idx)}
                            className="h-9 w-9 rounded-lg border text-neutral-900 hover:bg-neutral-100 active:scale-[.98] transition"
                            aria-label={`Agregar uno de ${item.isCombo ? item?.nombreCombo : item?.nombre}`}
                            title="Agregar uno"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {/* mínimo de compra */}
                {MIN_SUBTOTAL > 0 && (
                  <div
                    className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
                      reachedMin
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-amber-200 bg-amber-50 text-amber-800"
                    }`}
                  >
                    {reachedMin ? (
                      <>¡Has completado el mínimo de compra!</>
                    ) : (
                      <>Te faltan <b>{formatPEN(missing)}</b> para el mínimo de compra.</>
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
                          <div className="mb-2 text-[12px] text-neutral-600">{g.title}</div>
                          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                            {g.items.map((opt) => (
                              <article
                                key={opt.id}
                                className="relative w-[180px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5"
                              >
                                <div className="relative">
                                  {opt.imageAbs ? (
                                    <img
                                      src={opt.imageAbs}
                                      alt={opt.name}
                                      className="h-28 w-full object-cover"
                                      loading="lazy"
                                      decoding="async"
                                    />
                                  ) : (
                                    <div className="grid h-28 place-items-center bg-neutral-100 text-xs text-neutral-500">
                                      Sin imagen
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => addSuggestion(opt)}
                                    aria-label="Agregar"
                                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full
                                               bg-emerald-600 text-white shadow-md hover:bg-emerald-500"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="p-2.5">
                                  <div className="line-clamp-2 text-[13px] font-medium text-neutral-900">
                                    {opt.name}
                                  </div>
                                  <div className="mt-0.5 text-[12px] text-neutral-600">
                                    {currency(opt.price)}
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
                <h4 className="text-base font-semibold text-neutral-900">Tu carrito está vacío</h4>
                <p className="mt-1 text-sm text-neutral-600">Agrega platos para continuar con tu pedido.</p>
                <div className="mt-4">
                  <button
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
        <div className="sticky bottom-0 border-t border-black/5 bg-white/90 backdrop-blur px-4 py-3 shrink-0">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[15px] text-neutral-700">
              Subtotal:{" "}
              <span className="text-xl font-extrabold tracking-tight text-neutral-900">
                {formatPEN(total)}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onPay}
                className="h-11 rounded-xl bg-gradient-to-t from-emerald-600 to-emerald-500 px-5
                           text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20
                           hover:from-emerald-500 hover:to-emerald-400 active:scale-[.99] transition"
              >
                Pagar pedido
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
