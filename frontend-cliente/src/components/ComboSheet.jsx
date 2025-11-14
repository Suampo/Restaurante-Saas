// src/components/ComboSheet.jsx
import { useState, useEffect, useMemo, useRef } from "react";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute as makeAbs } from "../lib/ui";

/* --- UTILS & ICONS --- */
const currency = (n) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n || 0);

const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Iconos SVG optimizados
const IconCheck = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5" /></svg>
);
const IconClose = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const IconLeaf = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" /><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" /></svg>
);
const IconBowl = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 10h16a1 1 0 0 1 1 1v2a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8v-2a1 1 0 0 1 1-1Z" /><path d="M4 10h16a1 1 0 0 1 1 1v2a8 8 0 0 1-8 8h0a8 8 0 0 1-8-8v-2a1 1 0 0 1 1-1Z" /><path d="m6.1 10 .9-5a1 1 0 0 1 1.1-.8h7.8a1 1 0 0 1 1.1.8l.9 5" /></svg>
);

// Palabras clave para agrupar extras automáticamente
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
  
  // Memoizar la función absolute para evitar recreaciones
  const abs = useMemo(() => (u) => (absolute ? absolute(u) : makeAbs(apiBase, u)), [absolute, apiBase]);

  const entradas = useMemo(() => combo?.entradas ?? [], [combo]);
  const platos   = useMemo(() => combo?.platos ?? [], [combo]);

  const [entradaId, setEntradaId] = useState(null);
  const [platoId, setPlatoId] = useState(null);
  const [selectedExtras, setSelectedExtras] = useState({}); // { id: cantidad }

  // --- Lógica de agrupación de extras ---
  const extraGroups = useMemo(() => {
    // 1. Aplanar menú
    let allItems = [];
    if (Array.isArray(menu) && menu.length) allItems = menu;
    else if (Array.isArray(categories)) {
      categories.forEach(c => {
        if (Array.isArray(c.items)) allItems.push(...c.items.map(i => ({...i, categoria_id: i.categoria_id || c.id})));
      });
    }
    if (!allItems.length) return [];

    // 2. Función de búsqueda
    const getItemsByKeywords = (keys) => {
        const catIds = new Set(categories.filter(c => keys.some(k => norm(c?.nombre).includes(k))).map(c => c.id));
        return allItems
            .filter(i => catIds.has(i.categoria_id) && i.activo !== false)
            .map(i => ({
                id: i.id,
                name: i.nombre,
                price: Number(i.precio || 0),
                image: i.imagen_url ? abs(i.imagen_url) : null
            }));
    };

    const gExtras = getItemsByKeywords(KEYWORDS.extras);
    const gAcomp = getItemsByKeywords(KEYWORDS.acomp);
    const gDrinks = getItemsByKeywords(KEYWORDS.drinks);

    const groups = [];
    if (gExtras.length) groups.push({ key: "extras", title: "Toppings Extras", max: 5, items: gExtras });
    if (gAcomp.length)  groups.push({ key: "acomps", title: "Acompañamientos", max: 5, items: gAcomp });
    if (gDrinks.length) groups.push({ key: "drinks", title: "Bebidas", max: 10, items: gDrinks });
    
    return groups;
  }, [menu, categories, abs]);

  // --- Manejadores ---
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

  // --- Cálculos de Precio ---
  const comboPrice = Number(combo?.precio || 0);
  const extrasTotal = useMemo(() => {
    let total = 0;
    extraGroups.forEach(g => {
        g.items.forEach(item => {
            if (selectedExtras[item.id]) total += item.price * selectedExtras[item.id];
        });
    });
    return total;
  }, [selectedExtras, extraGroups]);

  const grandTotal = comboPrice + extrasTotal;

  // --- Efectos ---
  useEffect(() => {
    if (!open) {
      setEntradaId(null);
      setPlatoId(null);
      setSelectedExtras({});
      document.body.style.overflow = ""; // Restaurar scroll body
    } else {
      document.body.style.overflow = "hidden"; // Bloquear scroll body
      // Auto-seleccionar si solo hay 1 opción
      if (entradas.length === 1) setEntradaId(entradas[0].id);
      if (platos.length === 1) setPlatoId(platos[0].id);
    }
    return () => { document.body.style.overflow = ""; };
  }, [open, entradas, platos]);

  const entrada = entradas.find((e) => e.id === entradaId);
  const plato   = platos.find((p) => p.id === platoId);
  const canConfirm = Boolean(entrada && plato);

  const handleConfirm = () => {
    if (!canConfirm) return;
    
    // 1. Confirmar Combo principal
    onConfirm(entrada, plato);

    // 2. Agregar extras (Simulando eventos de carrito)
    const allExtras = extraGroups.flatMap(g => g.items);
    Object.entries(selectedExtras).forEach(([id, qty]) => {
        const itemData = allExtras.find(x => x.id === Number(id));
        if (itemData && qty > 0) {
            for (let i = 0; i < qty; i++) {
                const fakeItem = { 
                    id: itemData.id, 
                    nombre: itemData.name, 
                    precio: itemData.price, 
                    imagen_url: null // No necesitamos imagen en el carrito minimizado
                };
                window.dispatchEvent(new CustomEvent("cart:add", { detail: { item: fakeItem } }));
            }
        }
    });
  };

  if (!open || !combo) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      {/* Backdrop (Fondo oscuro) */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet (Contenedor Principal) */}
      <div
        className="
          relative w-full max-w-2xl overflow-hidden bg-white shadow-2xl 
          animate-in slide-in-from-bottom-10 duration-300
          rounded-t-[2rem] sm:rounded-[2rem] max-h-[92vh] flex flex-col
        "
        role="dialog"
        aria-modal="true"
      >
        
        {/* 1. HEADER STICKY */}
        <header className="relative z-10 flex shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 px-6 py-4 backdrop-blur-md">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Configura tu menú</p>
            <h2 className="text-xl font-bold text-gray-900 line-clamp-1">{combo.nombre}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </header>

        {/* 2. CONTENIDO SCROLLEABLE */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            
            {/* SECCIÓN: ENTRADAS */}
            <section>
              <div className="mb-3 flex items-center gap-2 text-emerald-700">
                <IconLeaf className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wide">1. Elige tu Entrada</h3>
              </div>
              <SelectionGrid 
                items={entradas} 
                selectedId={entradaId} 
                onSelect={setEntradaId} 
                abs={abs} 
                fallback={fallbackImg}
              />
            </section>

            {/* SECCIÓN: PLATOS */}
            <section>
              <div className="mb-3 flex items-center gap-2 text-orange-600">
                <IconBowl className="h-5 w-5" />
                <h3 className="text-sm font-bold uppercase tracking-wide">2. Elige tu Plato de Fondo</h3>
              </div>
              <SelectionGrid 
                items={platos} 
                selectedId={platoId} 
                onSelect={setPlatoId} 
                abs={abs} 
                fallback={fallbackImg}
              />
            </section>

            {/* SECCIÓN: EXTRAS (Si existen) */}
            {extraGroups.length > 0 && (
              <div className="mt-8 border-t border-dashed border-gray-200 pt-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">¿Deseas agregar algo más?</h3>
                <div className="space-y-6">
                  {extraGroups.map(group => (
                    <div key={group.key}>
                      <h4 className="mb-3 text-sm font-medium text-gray-500">{group.title}</h4>
                      <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-gray-50/50">
                        {group.items.map(item => (
                          <div key={item.id} className="flex items-center gap-4 p-3">
                            {/* Imagen pequeña */}
                            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-white shadow-sm">
                                <img 
                                    src={item.image || fallbackImg || FALLBACK_IMG} 
                                    alt="" 
                                    className="h-full w-full object-cover"
                                    onError={(e) => (e.currentTarget.src = fallbackImg || FALLBACK_IMG)}
                                />
                            </div>
                            
                            {/* Info */}
                            <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name}</div>
                                <div className="text-xs font-medium text-emerald-600">+{currency(item.price)}</div>
                            </div>

                            {/* Stepper (+/-) */}
                            <div className="flex items-center gap-3 rounded-full bg-white px-2 py-1 shadow-sm ring-1 ring-gray-200">
                                <button 
                                    onClick={() => toggleExtra(item.id, -1)}
                                    className={`h-7 w-7 flex items-center justify-center rounded-full transition ${selectedExtras[item.id] ? 'text-red-500 hover:bg-red-50' : 'text-gray-300'}`}
                                >
                                    -
                                </button>
                                <span className="w-4 text-center text-sm font-semibold tabular-nums">
                                    {selectedExtras[item.id] || 0}
                                </span>
                                <button 
                                    onClick={() => toggleExtra(item.id, 1, group.max)}
                                    className="h-7 w-7 flex items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 active:scale-90 transition"
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

        {/* 3. FOOTER ACTIONS */}
        <div className="shrink-0 border-t border-gray-100 bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
             {/* Resumen de precios */}
             <div className="flex flex-1 flex-col px-2">
                <div className="flex items-baseline justify-between sm:justify-start sm:gap-4">
                    <span className="text-sm text-gray-500">Total a pagar</span>
                    <span className="text-xl font-extrabold text-gray-900">{currency(grandTotal)}</span>
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
                    className={`
                        h-12 rounded-xl px-8 font-bold text-white shadow-lg shadow-emerald-500/20 transition-all
                        ${canConfirm 
                            ? 'bg-emerald-600 hover:bg-emerald-700 hover:scale-[1.02] active:scale-95' 
                            : 'bg-gray-300 cursor-not-allowed'}
                    `}
                >
                    {canConfirm ? 'Agregar al Pedido' : 'Completa la selección'}
                </button>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* --- SUBCOMPONENTE GRID --- */
function SelectionGrid({ items, selectedId, onSelect, abs, fallback }) {
    return (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item.id)}
                        className={`
                            group relative overflow-hidden rounded-2xl border text-left transition-all duration-200
                            ${isSelected 
                                ? 'border-emerald-500 bg-emerald-50/30 ring-2 ring-emerald-500/20' 
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'}
                        `}
                    >
                        {/* Badge de Check */}
                        {isSelected && (
                            <div className="absolute right-2 top-2 z-10 rounded-full bg-emerald-500 p-1 text-white shadow-sm animate-in zoom-in-50">
                                <IconCheck className="h-3 w-3" />
                            </div>
                        )}

                        <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100">
                            <img 
                                src={abs(item.imagen_url) || fallback || FALLBACK_IMG}
                                alt={item.nombre}
                                loading="lazy"
                                className={`h-full w-full object-cover transition duration-500 ${isSelected ? 'scale-105' : 'group-hover:scale-105'}`}
                                onError={(e) => (e.currentTarget.src = fallback || FALLBACK_IMG)}
                            />
                        </div>
                        <div className="p-3">
                            <p className={`line-clamp-2 text-sm font-medium ${isSelected ? 'text-emerald-900' : 'text-gray-700'}`}>
                                {item.nombre}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}