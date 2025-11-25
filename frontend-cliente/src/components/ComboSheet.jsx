// src/components/ComboSheet.jsx
import { useState, useEffect, useMemo } from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute as makeAbs } from "../lib/ui";

/* --- UTILS & ICONS --- */
const currency = (n) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(n || 0);

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

// Iconos SVG
const IconCheck = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const IconClose = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const IconLeaf = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
    <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
  </svg>
);
const IconBowl = (p) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M4 10h16a1 1 0 0 1 1 1v2a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8v-2a1 1 0 0 1 1-1Z" />
    <path d="m6.1 10 .9-5a1 1 0 0 1 1.1-.8h7.8a1 1 0 0 1 1.1.8l.9 5" />
  </svg>
);

/* Palabras clave para agrupar extras automáticamente */
const KEYWORDS = {
  extras: ["extra", "adicional", "topping", "agregado"],
  acomp: ["acompan", "acompañ", "guarn", "side", "guarnicion", "papas"],
  drinks: ["bebida", "gaseosa", "refresco", "drink", "agua"],
};

export default function ComboSheet({
  open,
  onClose,
  combo,
  onConfirm,
  absolute,
  fallbackImg,
}) {
  const { menu, categories, apiBase } = useMenuPublic();

  const abs = useMemo(
    () => (u) => (absolute ? absolute(u) : makeAbs(apiBase, u)),
    [absolute, apiBase]
  );

  const entradas = useMemo(() => combo?.entradas ?? [], [combo]);
  const platos = useMemo(() => combo?.platos ?? [], [combo]);

  const [entradaId, setEntradaId] = useState(null);
  const [platoId, setPlatoId] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({}); // { [id]: qty }

  // ===== Agrupación de extras =====
  const extraGroups = useMemo(() => {
    let allItems = [];
    if (Array.isArray(menu) && menu.length) {
      allItems = menu;
    } else if (Array.isArray(categories)) {
      categories.forEach((c) => {
        if (Array.isArray(c.items)) {
          allItems.push(
            ...c.items.map((i) => ({
              ...i,
              categoria_id: i.categoria_id || c.id,
            }))
          );
        }
      });
    }
    if (!allItems.length) return [];

    const getItemsByKeywords = (keys) => {
      const catIds = new Set(
        categories
          .filter((c) => keys.some((k) => norm(c?.nombre).includes(k)))
          .map((c) => c.id)
      );
      return allItems
        .filter((i) => catIds.has(i.categoria_id) && i.activo !== false)
        .map((i) => ({
          id: i.id,
          name: i.nombre,
          price: Number(i.precio || 0),
          image: i.imagen_url ? abs(i.imagen_url) : null,
        }));
    };

    const gExtras = getItemsByKeywords(KEYWORDS.extras);
    const gAcomp = getItemsByKeywords(KEYWORDS.acomp);
    const gDrinks = getItemsByKeywords(KEYWORDS.drinks);

    const groups = [];
    if (gExtras.length)
      groups.push({
        key: "extras",
        title: "Toppings extras",
        max: 5,
        items: gExtras,
      });
    if (gAcomp.length)
      groups.push({
        key: "acomps",
        title: "Acompañamientos",
        max: 5,
        items: gAcomp,
      });
    if (gDrinks.length)
      groups.push({
        key: "drinks",
        title: "Bebidas",
        max: 10,
        items: gDrinks,
      });

    return groups;
  }, [menu, categories, abs]);

  // ===== Step extras =====
  const toggleExtra = (id, delta, max = 99) => {
    setSelectedExtras((prev) => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(max, current + delta));
      if (next === 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: next };
    });
  };

  // ===== Cálculos de precios =====
  const comboPrice = Number(combo?.precio || 0);

  const extrasTotal = useMemo(() => {
    let total = 0;
    extraGroups.forEach((g) => {
      g.items.forEach((item) => {
        if (selectedExtras[item.id]) {
          total += item.price * selectedExtras[item.id];
        }
      });
    });
    return total;
  }, [selectedExtras, extraGroups]);

  const grandTotal = comboPrice + extrasTotal;

  // ===== Efectos de apertura/cierre =====
  useEffect(() => {
    if (!open) {
      setEntradaId(null);
      setPlatoId(null);
      setSelectedExtras({});
      document.body.style.overflow = "";
    } else {
      document.body.style.overflow = "hidden";

      if (entradas.length === 1) setEntradaId(entradas[0].id);
      if (platos.length === 1) setPlatoId(platos[0].id);
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [open, entradas, platos]);

  const entrada = entradas.find((e) => e.id === entradaId);
  const plato = platos.find((p) => p.id === platoId);
  const canConfirm = Boolean(entrada && plato);

  const totalSteps =
    (entradas.length ? 1 : 0) + (platos.length ? 1 : 0) || 0;
  const completedSteps =
    (entrada ? 1 : 0) + (plato ? 1 : 0);

  const handleConfirm = () => {
    if (!canConfirm) return;

    // 1) Combo principal
    onConfirm(entrada, plato);

    // 2) Extras al carrito
    const allExtras = extraGroups.flatMap((g) => g.items);
    Object.entries(selectedExtras).forEach(([id, qty]) => {
      const itemData = allExtras.find((x) => x.id === Number(id));
      if (itemData && qty > 0) {
        for (let i = 0; i < qty; i++) {
          const fakeItem = {
            id: itemData.id,
            nombre: itemData.name,
            precio: itemData.price,
            imagen_url: null,
          };
          window.dispatchEvent(
            new CustomEvent("cart:add", { detail: { item: fakeItem } })
          );
        }
      }
    });
  };

  if (!open || !combo) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="
          relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden
          rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]
        "
        role="dialog"
        aria-modal="true"
      >
        {/* HEADER — SOLO TEXTO, SIN TARJETA VERDE */}
        <header className="relative z-10 border-b border-gray-100 bg-white/90 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                Combo
              </p>
              <h2 className="text-xl font-extrabold leading-tight text-gray-900">
                {combo.nombre}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Personaliza tu pedido •{" "}
                <span className="font-semibold text-gray-900">
                  {currency(comboPrice)}
                </span>
              </p>
              {totalSteps > 0 && (
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  {completedSteps} de {totalSteps} pasos completados
                </p>
              )}
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800"
            >
              <IconClose className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* ENTRADA */}
            {entradas.length > 0 && (
              <SectionBlock
                icon={<IconLeaf className="h-5 w-5 text-emerald-600" />}
                title="ENTRADA"
                subtitle="Elige 1 opción"
                remaining={entrada ? 0 : 1}
              >
                <SelectionCarousel
                  items={entradas}
                  selectedId={entradaId}
                  onSelect={setEntradaId}
                  abs={abs}
                  fallback={fallbackImg}
                />
              </SectionBlock>
            )}

            {/* PLATO */}
            {platos.length > 0 && (
              <SectionBlock
                icon={<IconBowl className="h-5 w-5 text-orange-500" />}
                title="PLATO"
                subtitle="Elige 1 opción"
                remaining={plato ? 0 : 1}
              >
                <SelectionCarousel
                  items={platos}
                  selectedId={platoId}
                  onSelect={setPlatoId}
                  abs={abs}
                  fallback={fallbackImg}
                />
              </SectionBlock>
            )}

            {/* EXTRAS */}
            {extraGroups.length > 0 && (
              <div className="mt-4 border-t border-dashed border-gray-200 pt-6">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-gray-500">
                  OPCIONALES
                </h3>
                <p className="mb-4 text-sm text-gray-600">
                  Agrega toppings, acompañamientos o bebidas extra a tu combo.
                </p>

                <div className="space-y-6">
                  {extraGroups.map((group) => (
                    <div key={group.key}>
                      <h4 className="mb-3 text-sm font-semibold text-gray-800">
                        {group.title}
                      </h4>
                      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50/50">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 p-3"
                          >
                            {/* Imagen pequeña */}
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm">
                              <img
                                src={item.image || fallbackImg || FALLBACK_IMG}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src =
                                    fallbackImg || FALLBACK_IMG;
                                }}
                              />
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {item.name}
                              </div>
                              <div className="text-xs font-medium text-emerald-600">
                                + {currency(item.price)}
                              </div>
                            </div>

                            {/* Stepper */}
                            <div className="flex items-center gap-3 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-gray-200">
                              <button
                                onClick={() =>
                                  toggleExtra(item.id, -1, group.max)
                                }
                                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
                                  selectedExtras[item.id]
                                    ? "text-red-500 hover:bg-red-50"
                                    : "text-gray-300"
                                }`}
                              >
                                -
                              </button>
                              <span className="w-4 text-center text-sm font-semibold tabular-nums">
                                {selectedExtras[item.id] || 0}
                              </span>
                              <button
                                onClick={() =>
                                  toggleExtra(item.id, 1, group.max)
                                }
                                className="flex h-7 w-7 items-center justify-center rounded-full text-sm text-emerald-600 hover:bg-emerald-50 active:scale-90 transition"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* FOOTER */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
            {/* Resumen de precios */}
            <div className="flex flex-1 flex-col px-2">
              <div className="flex items-baseline justify-between sm:justify-start sm:gap-4">
                <span className="text-sm text-gray-500">Total a pagar</span>
                <span className="text-xl font-extrabold text-gray-900">
                  {currency(grandTotal)}
                </span>
              </div>
              {extrasTotal > 0 && (
                <div className="text-xs text-gray-400">
                  Base {currency(comboPrice)} + Extras {currency(extrasTotal)}
                </div>
              )}
            </div>

            {/* Botones */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="h-12 rounded-xl border border-gray-200 px-6 font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className={`h-12 rounded-xl px-8 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all ${
                  canConfirm
                    ? "bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95"
                    : "cursor-not-allowed bg-gray-300"
                }`}
              >
                {canConfirm ? "Agregar al Pedido" : "Completa la selección"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===== Sub-componentes ===== */

function SectionBlock({ icon, title, subtitle, remaining, children }) {
  const pillLabel =
    remaining > 0 ? `FALTA ${remaining}` : "LISTO";

  const pillClass =
    remaining > 0
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-emerald-300 bg-emerald-50 text-emerald-700";

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            {icon}
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-700">
              {title}
            </p>
          </div>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${pillClass}`}
        >
          {pillLabel}
        </span>
      </div>
      {children}
    </section>
  );
}

/**
 * Carrusel horizontal para Entradas / Platos
 */
function SelectionCarousel({ items, selectedId, onSelect, abs, fallback }) {
  if (!items?.length) return null;

  return (
    <div className="scroll-snap-x no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
      <div className="shrink-0 w-1" aria-hidden="true" />
      {items.map((item) => {
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`group relative flex min-w-[72%] max-w-[260px] flex-col overflow-hidden rounded-2xl border text-left shadow-sm transition-all duration-200 sm:min-w-[220px] ${
              isSelected
                ? "border-emerald-500 bg-emerald-50/40 ring-2 ring-emerald-500/20"
                : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-md"
            }`}
          >
            {/* Check */}
            {isSelected && (
              <div className="absolute right-2 top-2 z-10 rounded-full bg-emerald-500 p-1.5 text-white shadow-sm">
                <IconCheck className="h-3.5 w-3.5" />
              </div>
            )}

            {/* Imagen */}
            <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
              <img
                src={abs(item.imagen_url) || fallback || FALLBACK_IMG}
                alt={item.nombre}
                loading="lazy"
                className={`h-full w-full object-cover transition duration-500 ${
                  isSelected ? "scale-105" : "group-hover:scale-105"
                }`}
                onError={(e) => {
                  e.currentTarget.src = fallback || FALLBACK_IMG;
                }}
              />
            </div>

            {/* Texto */}
            <div className="space-y-0.5 p-3">
              <p
                className={`line-clamp-2 text-sm font-semibold ${
                  isSelected ? "text-emerald-900" : "text-gray-800"
                }`}
              >
                {item.nombre}
              </p>
              {item.precio ? (
                <p className="text-xs font-medium text-emerald-600">
                  + {currency(item.precio)}
                </p>
              ) : null}
            </div>
          </button>
        );
      })}
      <div className="shrink-0 w-1" aria-hidden="true" />
    </div>
  );
}
