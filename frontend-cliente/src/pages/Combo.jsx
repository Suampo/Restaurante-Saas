// src/pages/Combo.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { fetchMenuV2 } from "../services/restaurantApi";
import {
  FALLBACK_IMG,
  absolute as toAbsolute,
  formatPEN as fmtPEN,
} from "../lib/ui.js";

const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

// --- UTILS ---
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function resolveComboImg(abs, c) {
  const candidates = [
    c?.imagen_url,
    c?.imagen,
    c?.image_url,
    c?.image,
    c?.foto_url,
    c?.foto,
  ].filter(Boolean);
  for (const u of candidates) {
    const s = String(u);
    if (/^(https?:)?\/\//i.test(s) || s.startsWith("data:")) return s;
    return abs(s);
  }
  return null;
}

// --- ICONS ---
const CheckIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={className}>
    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowLeftIcon = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// --- COMPONENTS ---

/**
 * Skeleton para la carga del combo
 */
function ComboSkeleton() {
  return (
    <div className="space-y-8 animate-pulse mt-6">
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="h-6 w-48 bg-gray-200 rounded mb-4" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className="rounded-2xl bg-white border border-gray-100 p-2">
                <div className="aspect-[4/3] w-full bg-gray-200 rounded-xl mb-2" />
                <div className="h-3 w-3/4 bg-gray-200 rounded mb-1" />
                <div className="h-3 w-1/4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tarjeta de un ítem dentro de un grupo
 */
function ComboItemCard({ item, selected, disabled, onClick, absUrl }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl border text-left transition-all duration-200",
        selected
          ? "border-emerald-500 bg-emerald-50/50 ring-1 ring-emerald-500 shadow-md"
          : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm",
        disabled && !selected && "opacity-50 cursor-not-allowed grayscale-[0.5]"
      )}
    >
      {/* Indicador de selección (Check badge) */}
      {selected && (
        <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-sm animate-in zoom-in-50 duration-200">
          <CheckIcon className="h-3.5 w-3.5 text-white" />
        </div>
      )}

      <div className="aspect-[4/3] w-full overflow-hidden bg-gray-100 relative">
        <img
          src={absUrl(item.imagen_url) || FALLBACK_IMG}
          alt={item.nombre}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
        />
        {/* Gradiente sutil en la base de la imagen */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/10 to-transparent" />
      </div>

      <div className="flex flex-1 flex-col p-3">
        <h3 className={cx("text-sm font-medium line-clamp-2 leading-snug", selected ? "text-emerald-900" : "text-gray-700")}>
          {item.nombre}
        </h3>
        <div className="mt-auto pt-1 text-xs text-gray-500 font-medium">
           {Number(item.precio) > 0 ? `+ S/ ${Number(item.precio).toFixed(2)}` : "Incluido"}
        </div>
      </div>
    </button>
  );
}

export default function Combo() {
  const nav = useNavigate();
  const location = useLocation();
  const { combos = [], restaurantId } = useMenuPublic();

  const qs = new URLSearchParams(location.search);
  const comboIdQ = qs.get("comboId");

  // --- LOGIC: Contexto del Combo ---
  const comboCtx = useMemo(() => {
    if (!comboIdQ) return combos?.[0] || null;
    return (
      combos.find((c) => String(c.id) === String(comboIdQ)) ||
      combos?.[0] ||
      null
    );
  }, [combos, comboIdQ]);

  const [combo, setCombo] = useState(comboCtx);
  const [loading, setLoading] = useState(!comboCtx?.grupos);
  const [error, setError] = useState("");

  const absolute = useCallback((u) => toAbsolute(API_BASE, u), []);
  const heroImg = resolveComboImg(absolute, combo || {});

  // --- EFFECT: Cargar detalles completos (v2) ---
  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        if (comboCtx?.grupos?.length) {
          setCombo(comboCtx);
          setLoading(false);
          return;
        }
        setLoading(true);
        const { combos: v2 } = await fetchMenuV2(restaurantId, {
          credentials: "include",
        });
        const full = (v2 || []).find(
          (c) => String(c.id) === String(comboCtx?.id)
        );
        
        if (mounted) {
          setCombo(full ? { ...comboCtx, ...full } : comboCtx || null);
        }
      } catch {
        if (mounted) setError("No se pudo cargar el detalle del combo.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, [restaurantId, comboCtx]);

  // --- LOGIC: Selección ---
  const [sel, setSel] = useState({}); // { [grupoId]: Set(itemIds) }

  // Resetear selección al cambiar de combo
  useEffect(() => {
    setSel({});
  }, [combo?.id]);

  const toggle = (g, itemId) => {
    setSel((prev) => {
      const currentSet = new Set(prev[g.id] || []);
      if (currentSet.has(itemId)) {
        currentSet.delete(itemId);
      } else {
        const max = Math.max(1, Number(g.max ?? 1));
        // Si ya llegamos al máximo y es single selection (max 1), reemplazamos
        if (max === 1 && currentSet.size >= 1) {
           currentSet.clear();
           currentSet.add(itemId);
        } else if (currentSet.size < max) {
           currentSet.add(itemId);
        } else {
          return prev; // No hacer nada si está lleno (multi-select)
        }
      }
      return { ...prev, [g.id]: currentSet };
    });
  };

  // --- CALCULOS ---
  const totalBase = Number(combo?.precio || 0);
  // (Opcional: Si quieres sumar precios de items extra, hazlo aquí. Por ahora uso precio base)
  const displayPrice = fmtPEN ? fmtPEN(totalBase) : `S/ ${totalBase.toFixed(2)}`;

  const validationState = useMemo(() => {
    if (!combo?.grupos?.length) return { valid: false, completed: 0, total: 0 };
    
    let valid = true;
    let completedCount = 0;

    for (const g of combo.grupos) {
      const count = sel[g.id]?.size ?? 0;
      const min = Math.max(0, Number(g.min ?? 1));
      const max = Math.max(1, Number(g.max ?? 1));
      
      const groupOk = count >= min && count <= max;
      if (!groupOk) valid = false;
      if (groupOk) completedCount++;
    }
    
    return { 
      valid, 
      completed: completedCount, 
      total: combo.grupos.length 
    };
  }, [combo, sel]);

  const addCombo = () => {
    if (!combo) return;
    const gruposPayload = (combo.grupos || []).map((g) => ({
      grupoId: g.id,
      items: [...(sel[g.id] || [])].map((id) => ({ id })),
    }));
    
    window.dispatchEvent(
      new CustomEvent("cart:add", {
        detail: {
          item: {
            isCombo: true,
            comboId: combo.id,
            nombreCombo: combo.nombre || "Menú",
            precio: totalBase, // + extras si aplica
            cantidad: 1,
            grupos: gruposPayload,
          },
        },
      })
    );
    nav(-1);
  };

  // --- UI FOOTER SPACING ---
  // Usamos un ResizeObserver simple para dar padding al contenedor
  const footerRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(90);

  useLayoutEffect(() => {
    if (!footerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setFooterHeight(entry.contentRect.height);
    });
    ro.observe(footerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="min-h-screen w-full bg-white text-gray-900">
      {/* 1. CONTENEDOR PRINCIPAL */}
      <div 
        className="mx-auto w-full max-w-5xl px-4 pt-4"
        style={{ paddingBottom: `calc(${footerHeight}px + 20px)` }}
      >
        
        {/* 2. BOTÓN VOLVER (Flotante o estático) */}
        <button
          onClick={() => nav(-1)}
          className="group mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-emerald-100 hover:text-emerald-700 active:scale-95"
          aria-label="Volver"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>

        {/* 3. HERO CARD */}
        <div className="relative overflow-hidden rounded-3xl bg-gray-900 shadow-xl ring-1 ring-black/5">
          <div className="absolute inset-0">
            {heroImg ? (
               <img src={heroImg} alt="" className="h-full w-full object-cover opacity-90" />
            ) : (
               <div className="h-full w-full bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500" />
            )}
            {/* Gradiente para legibilidad */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          </div>
          
          <div className="relative p-6 md:p-8">
            <div className="mb-1 flex items-center gap-2">
               <span className="inline-flex items-center rounded-md bg-white/20 px-2 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  Combo
               </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl drop-shadow-sm">
              {combo?.nombre || "Cargando..."}
            </h1>
            <p className="mt-2 text-base text-gray-200 font-medium">
              Personaliza tu pedido · <span className="text-white font-bold">{displayPrice}</span>
            </p>

            {/* Barra de progreso visual */}
            {validationState.total > 0 && (
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 overflow-hidden rounded-full bg-white/20 h-1.5">
                  <div 
                    className="h-full bg-emerald-400 transition-all duration-500 ease-out"
                    style={{ width: `${(validationState.completed / validationState.total) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-emerald-300 tracking-wider uppercase">
                  {validationState.completed} de {validationState.total} PASOS
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 4. ERROR / LOADING */}
        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}
        
        {loading && <ComboSkeleton />}

        {/* 5. GRUPOS DE SELECCIÓN */}
        {!loading && !error && combo?.grupos?.length > 0 && (
          <div className="mt-8 space-y-10">
            {combo.grupos
              .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
              .map((g, idx) => {
                const selectedSet = sel[g.id] || new Set();
                const min = Math.max(0, Number(g.min ?? 1));
                const max = Math.max(1, Number(g.max ?? 1));
                const isSatisfied = selectedSet.size >= min && selectedSet.size <= max;
                const remaining = Math.max(0, min - selectedSet.size);

                return (
                  <section key={g.id} className="animate-in fade-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 100}ms` }}>
                    
                    {/* Encabezado del Grupo */}
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">{g.nombre}</h2>
                        <p className="text-sm text-gray-500">
                          {max === 1 ? "Elige 1 opción" : `Elige hasta ${max} opciones`}
                        </p>
                      </div>
                      
                      {/* Badge de estado del grupo */}
                      <div className={cx(
                        "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shadow-sm ring-1",
                        isSatisfied
                          ? "bg-emerald-100 text-emerald-700 ring-emerald-200"
                          : "bg-amber-50 text-amber-700 ring-amber-200"
                      )}>
                         {isSatisfied ? "Completado" : `Faltan ${remaining}`}
                      </div>
                    </div>

                    {/* Grid de Items */}
                    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                      {(g.items || []).map((item) => {
                        const isSelected = selectedSet.has(item.id);
                        // Deshabilitar si NO está seleccionado Y ya llegamos al límite máximo
                        // (Solo aplica si max > 1. Si max=1, el comportamiento es "radio button" y no se deshabilita)
                        const isMaxReached = !isSelected && selectedSet.size >= max && max > 1;

                        return (
                          <ComboItemCard
                            key={item.id}
                            item={item}
                            absUrl={absolute}
                            selected={isSelected}
                            disabled={isMaxReached}
                            onClick={() => toggle(g, item.id)}
                          />
                        );
                      })}
                    </div>
                  </section>
                );
              })}
          </div>
        )}
      </div>

      {/* 6. FOOTER STICKY */}
      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/50 bg-white/80 backdrop-blur-lg transition-all"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
               <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total a pagar</p>
               <div className="flex items-baseline gap-1">
                 <span className="text-xl font-extrabold text-gray-900">{displayPrice}</span>
               </div>
            </div>

            <button
              onClick={addCombo}
              disabled={!validationState.valid}
              className={cx(
                "relative h-12 overflow-hidden rounded-xl px-8 font-bold text-white shadow-lg transition-all active:scale-95",
                validationState.valid
                  ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30"
                  : "bg-gray-300 text-gray-500 shadow-none cursor-not-allowed"
              )}
            >
              <span className="relative z-10">
                 {validationState.valid ? "Agregar al Pedido" : "Selecciona items"}
              </span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}