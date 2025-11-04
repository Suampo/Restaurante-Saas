import { useState, useEffect, useMemo, useRef } from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute as makeAbs } from "../lib/ui";

/* Iconos inline */
const Check = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const Close = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
const Bowl = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...p}>
    <path d="M4 13a8 8 0 0016 0H4z" />
    <path d="M3 13h18" />
  </svg>
);
const Leaf = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...p}>
    <path d="M12 20c4.418 0 8-3.582 8-8 0-5-4-8-8-8-4.418 0-8 3-8 8 0 4.418 3.582 8 8 8z" />
    <path d="M12 12c-2 2-3 4-3 6" />
  </svg>
);

const currency = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

const KEYWORDS = {
  extras: ["extra", "adicional", "topping", "agregado"],
  acomp: ["acompan", "acompañ", "guarn", "side", "guarnicion"],
  drinks: ["bebida", "gaseosa", "refresco", "drink"],
};

export default function ComboSheet({
  open,
  onClose,
  combo,
  onConfirm,
  absolute,
  fallbackImg,
  formatPEN,
}) {
  const { menu, categories, apiBase } = useMenuPublic();
  const abs = useMemo(() => (u) => (absolute ? absolute(u) : makeAbs(apiBase, u)), [absolute, apiBase]);

  const entradas = useMemo(() => combo?.entradas ?? [], [combo]);
  const platos   = useMemo(() => combo?.platos ?? [], [combo]);

  const [entradaId, setEntradaId] = useState(null);
  const [platoId, setPlatoId] = useState(null);

  // ===== lista global segura =====
  const menuAll = useMemo(() => {
    if (Array.isArray(menu) && menu.length) return menu;
    if (Array.isArray(categories) && categories.length) {
      const out = [];
      for (const c of categories) {
        const arr = Array.isArray(c?.items) ? c.items : [];
        for (const m of arr) out.push({ ...m, categoria_id: m?.categoria_id ?? c?.id ?? null });
      }
      return out;
    }
    return [];
  }, [menu, categories]);

  // ===== recomendados =====
  const grupos = useMemo(() => {
    if (!Array.isArray(menuAll) || !Array.isArray(categories)) return [];
    const findCatIds = (keywords) =>
      new Set(categories.filter((c) => keywords.some((k) => norm(c?.nombre).includes(k))).map((c) => c.id));
    const toOpt = (x) => ({ id: x.id, name: x.nombre, price: Number(x.precio || 0), image: x.imagen_url ? abs(x.imagen_url) : null });
    const pick = (idSet) => menuAll.filter((m) => idSet.has(m.categoria_id) && m.activo !== false).map(toOpt);

    const extras = pick(findCatIds(KEYWORDS.extras));
    const acomp  = pick(findCatIds(KEYWORDS.acomp));
    const drinks = pick(findCatIds(KEYWORDS.drinks));

    const out = [];
    if (extras.length) out.push({ key: "extras", title: "Elige tus Toppings Extras", max: 10, items: extras });
    if (acomp.length)  out.push({ key: "acomps", title: "Acompañamientos recomendados", max: 10, items: acomp });
    if (drinks.length) out.push({ key: "drinks", title: "Bebidas recomendadas", max: 10, items: drinks });
    return out;
  }, [menuAll, categories, abs]);

  const [selected, setSelected] = useState({});
  const toggleAdd = (id, delta, max = 99) => {
    setSelected((prev) => {
      const v = Math.max(0, Math.min(max, (prev[id] || 0) + delta));
      const next = { ...prev, [id]: v };
      if (next[id] === 0) delete next[id];
      return next;
    });
  };

  const priceStr = (formatPEN ? formatPEN(combo?.precio) : currency(combo?.precio));
  const comboPrice = Number(combo?.precio || 0);

  const extrasTotal = useMemo(() => {
    const priceMap = new Map();
    grupos.forEach((g) => g.items.forEach((i) => priceMap.set(i.id, i.price)));
    return Object.entries(selected).reduce((s, [id, c]) => s + (priceMap.get(Number(id)) || 0) * c, 0);
  }, [selected, grupos]);

  const grandTotal = comboPrice + extrasTotal;

  useEffect(() => {
    if (!open) { setEntradaId(null); setPlatoId(null); setSelected({}); return; }
    if (entradas.length === 1) setEntradaId(entradas[0].id);
    if (platos.length === 1) setPlatoId(platos[0].id);
  }, [open, entradas, platos]);

  if (!open || !combo) return null;

  const entrada = useMemo(() => entradas.find((e) => e.id === entradaId) || null, [entradas, entradaId]);
  const plato   = useMemo(() => platos.find((p) => p.id === platoId) || null, [platos, platoId]);

  const canConfirm = Boolean(entrada && plato);

  const addExtrasAfterConfirm = () => {
    const all = grupos.flatMap((g) => g.items);
    Object.entries(selected).forEach(([id, c]) => {
      const opt = all.find((x) => x.id === Number(id));
      if (!opt || c <= 0) return;
      const fake = { id: opt.id, nombre: opt.name, precio: opt.price, imagen_url: null };
      for (let i = 0; i < c; i++) {
        window.dispatchEvent(new CustomEvent("cart:add", { detail: { item: fake } }));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={onClose} />

      <div
        className="
          absolute inset-x-0 bottom-0 max-h-[90vh] overflow-hidden
          rounded-t-3xl border border-white/10 bg-white/90 backdrop-blur-xl
          shadow-[0_-24px_64px_-12px_rgba(0,0,0,.28)]
          translate-y-0 animate-fadeInUp
        "
        role="dialog"
        aria-modal="true"
        aria-labelledby="combo-title"
      >
        {/* Handle */}
        <div className="flex justify-center pt-2">
          <div className="h-1.5 w-12 rounded-full bg-neutral-300/80" />
        </div>

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 sm:px-6 sm:py-4 bg-gradient-to-t from-white/70 to-white/30 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="text-[12px] text-neutral-500">Combo</div>
            <h3 id="combo-title" className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900 line-clamp-1">
              {combo.nombre} <span className="text-neutral-400">·</span>{" "}
              <span className="text-emerald-700">{priceStr}</span>
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-neutral-200 bg-white/80 text-neutral-700 hover:bg-neutral-50"
          >
            <Close className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 overflow-y-auto px-4 pb-28 pt-4 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-6 md:grid-cols-[1fr_1fr_0.9fr]">
              {/* Entradas */}
              <section aria-labelledby="label-entrada">
                <header className="mb-2 flex items-center gap-2">
                  <Leaf className="h-4 w-4 text-emerald-600" />
                  <h4 id="label-entrada" className="text-sm font-medium text-neutral-900">Elige una entrada</h4>
                </header>
                <RadioGrid
                  labelId="label-entrada"
                  items={entradas}
                  selectedId={entradaId}
                  setSelectedId={setEntradaId}
                  absolute={abs}
                  fallbackImg={fallbackImg || FALLBACK_IMG}
                />
              </section>

              {/* Platos */}
              <section aria-labelledby="label-plato">
                <header className="mb-2 flex items-center gap-2">
                  <Bowl className="h-4 w-4 text-emerald-600" />
                  <h4 id="label-plato" className="text-sm font-medium text-neutral-900">Elige un plato</h4>
                </header>
                <RadioGrid
                  labelId="label-plato"
                  items={platos}
                  selectedId={platoId}
                  setSelectedId={setPlatoId}
                  absolute={abs}
                  fallbackImg={fallbackImg || FALLBACK_IMG}
                />
              </section>

              {/* Preview */}
              <aside className="hidden md:block">
                <div className="rounded-2xl border bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
                  <div className="mb-2 text-sm font-medium text-neutral-900">Tu selección</div>
                  <PreviewRow
                    label="Entrada"
                    value={entrada?.nombre}
                    img={entrada ? (abs(entrada.imagen_url) || FALLBACK_IMG) : null}
                  />
                  <PreviewRow
                    label="Plato"
                    value={plato?.nombre}
                    img={plato ? (abs(plato.imagen_url) || FALLBACK_IMG) : null}
                  />
                  <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">Total combo</span>
                      <span className="font-semibold text-neutral-900">{priceStr}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500">Incluye 1 entrada + 1 plato.</div>
                  </div>
                </div>
              </aside>
            </div>

            {/* Recomendados */}
            {grupos.length > 0 && (
              <section className="mt-6">
                {grupos.map((g) => {
                  const totalSel = Object.values(selected).reduce((a, b) => a + b, 0);
                  return (
                    <div key={g.key} className="mt-6 first:mt-0">
                      <div className="mb-2">
                        <div className="text-[13px] font-semibold tracking-wide text-neutral-900">{g.title}</div>
                        <div className="text-[12px] text-neutral-500">Elige máximo {g.max} opciones.</div>
                      </div>
                      <ul className="divide-y rounded-2xl border bg-white/70 ring-1 ring-black/5">
                        {g.items.map((opt) => {
                          const count = selected[opt.id] || 0;
                          return (
                            <li key={opt.id} className="flex items-center gap-3 px-3 py-2.5">
                              <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg ring-1 ring-black/10">
                                {opt.image ? (
                                  <img src={opt.image} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[11px] text-neutral-400">IMG</div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="text-[14px] font-medium text-neutral-900">{opt.name}</div>
                                <div className="text-[12px] text-neutral-600">+ {currency(opt.price)}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => toggleAdd(opt.id, -1)} className="h-8 w-8 rounded-full border text-lg leading-none text-neutral-700 hover:bg-neutral-50">−</button>
                                <div className="w-5 text-center text-sm tabular-nums">{count}</div>
                                <button
                                  type="button"
                                  onClick={() => { if (totalSel >= g.max) return; toggleAdd(opt.id, +1); }}
                                  className="h-8 w-8 rounded-full bg-emerald-600 text-lg leading-none text-white hover:bg-emerald-500"
                                >
                                  +
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </section>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-20 bg-gradient-to-b from-transparent to-white/85">
          <div className="mx-auto max-w-6xl px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="mb-2 h-[1px] w-full bg-gradient-to-r from-transparent via-black/10 to-transparent" />
            <div className="flex items-center justify-between rounded-2xl border bg-white/90 px-3 py-2.5 shadow-sm ring-1 ring-black/5 sm:px-4">
              <div className="min-w-0">
                <div className="text-[12px] text-neutral-500">Total</div>
                <div className="text-[15px] font-bold tracking-tight text-neutral-900">
                  {currency(grandTotal)}
                </div>
                {extrasTotal > 0 && (
                  <div className="text-[11px] text-neutral-500">
                    (Combo {currency(comboPrice)} + Recomendados {currency(extrasTotal)})
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-11 items-center rounded-xl border border-neutral-300 bg-white px-4
                             text-[14px] font-medium text-neutral-800 hover:bg-neutral-50 active:translate-y-[1px] transition"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!canConfirm}
                  onClick={() => {
                    if (!canConfirm) return;
                    onConfirm(entrada, plato);
                    addExtrasAfterConfirm();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-xl
                             bg-gradient-to-t from-emerald-600 to-emerald-500 px-5
                             text-[15px] font-semibold text-white shadow-sm ring-1 ring-emerald-700/20
                             transition hover:from-emerald-500 hover:to-emerald-400
                             active:translate-y-[1px] disabled:opacity-60 disabled:grayscale"
                >
                  Agregar combo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>{/* sheet */}
    </div>
  );
}

/* ======= Subcomponentes ======= */
function RadioGrid({ labelId, items, selectedId, setSelectedId, absolute, fallbackImg }) {
  const groupRef = useRef(null);

  const handleKey = (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    if (!items.length) return;
    const idx = Math.max(0, items.findIndex((x) => x.id === selectedId));
    const delta = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
    const next = (idx + delta + items.length) % items.length;
    setSelectedId(items[next].id);
    const btns = groupRef.current?.querySelectorAll("[role='radio']");
    btns?.[next]?.focus();
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-labelledby={labelId}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
      onKeyDown={handleKey}
    >
      {items.map((it, i) => (
        <OptionTile
          key={it.id}
          selected={selectedId === it.id}
          title={it.nombre}
          img={(absolute && absolute(it.imagen_url)) || fallbackImg || FALLBACK_IMG}
          onSelect={() => setSelectedId(it.id)}
          tabIndex={selectedId === it.id || (selectedId == null && i === 0) ? 0 : -1}
        />
      ))}
    </div>
  );
}

function OptionTile({ selected, title, img, onSelect, tabIndex = 0 }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      tabIndex={tabIndex}
      className={`
        group relative overflow-hidden rounded-2xl bg-white text-left shadow-sm transition focus:outline-none
        ${selected
          ? "ring-2 ring-emerald-500"
          : "ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-md hover:-translate-y-[1px]"}
      `}
    >
      <div className="relative aspect-[4/3] w-full">
        {img ? (
          <img
            src={img}
            alt={title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition duration-300"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="absolute inset-0 bg-neutral-100" />
        )}
        {selected && (
          <div className="absolute right-2 top-2 rounded-full bg-white/95 p-1.5 text-emerald-600 shadow-sm">
            <Check className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="p-2.5">
        <div className="line-clamp-1 text-[13px] font-semibold text-neutral-900">{title}</div>
      </div>
    </button>
  );
}

function PreviewRow({ label, value, img }) {
  return (
    <div className="mb-2 flex items-center gap-3 rounded-xl border bg-white/85 p-2.5 ring-1 ring-black/5">
      <div className="min-w-[64px] text-[12px] font-medium text-neutral-600">{label}</div>
      {value ? (
        <>
          {img && (
            <img
              src={img}
              alt={value}
              className="h-9 w-12 rounded-md object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="line-clamp-1 text-[13px] text-neutral-900">{value}</div>
        </>
      ) : (
        <div className="text-[13px] text-neutral-400">Sin seleccionar</div>
      )}
    </div>
  );
}
