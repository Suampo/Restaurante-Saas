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

// --- ICONOS ---
const CheckIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="4" // Más gordito para que se vea premium
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

const ArrowLeftIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 19l-7-7 7-7" />
  </svg>
);

/**
 * Skeleton Premium
 */
function ComboSkeleton() {
  return (
    <div className="mt-8 animate-pulse space-y-10 px-4">
      {[1, 2].map((i) => (
        <div key={i}>
          <div className="mb-4 flex items-center justify-between">
             <div className="h-6 w-32 rounded-lg bg-gray-200" />
             <div className="h-6 w-16 rounded-full bg-gray-200" />
          </div>
          <div className="flex gap-4 overflow-hidden">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="h-48 w-40 shrink-0 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm"
              >
                <div className="aspect-[4/3] w-full rounded-xl bg-gray-200 mb-3" />
                <div className="mb-2 h-3 w-3/4 rounded bg-gray-200" />
                <div className="h-3 w-1/2 rounded bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Tarjeta de Item (Rediseñada estilo App Delivery)
 */
function ComboItemCard({ item, selected, disabled, onClick, absUrl }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 snap-start",
        // Dimensiones optimizadas para móviles: 160px permite ver 1.5 items en 320px
        "min-w-[160px] w-[160px] max-w-[160px]",
        "sm:min-w-[200px] sm:w-[200px] sm:max-w-[200px]",
        
        selected
          ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50/30 shadow-md scale-[1.02]"
          : "border-gray-200 bg-white shadow-sm hover:border-gray-300 hover:shadow-md hover:-translate-y-1",
          
        disabled && !selected && "cursor-not-allowed opacity-50 grayscale"
      )}
    >
      {/* Indicador de Selección (Check Animado) */}
      <div 
        className={cx(
            "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-300",
            selected ? "bg-emerald-500 scale-100" : "bg-white/80 scale-0 opacity-0"
        )}
      >
        <CheckIcon className="h-3.5 w-3.5 text-white" />
      </div>

      {/* Imagen */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100">
        <img
          src={absUrl(item.imagen_url) || FALLBACK_IMG}
          alt={item.nombre}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
        />
        {/* Gradiente sutil para dar volumen */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col p-3 text-left">
        <h3
          className={cx(
            "line-clamp-2 text-[13px] leading-tight sm:text-sm",
            selected ? "font-bold text-emerald-900" : "font-semibold text-gray-700"
          )}
        >
          {item.nombre}
        </h3>
        
        <div className="mt-auto pt-2">
            <span className={cx(
                "inline-block rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                Number(item.precio) > 0 
                    ? "bg-amber-100 text-amber-800" 
                    : "bg-gray-100 text-gray-500"
            )}>
                 {Number(item.precio) > 0
                    ? `+ S/ ${Number(item.precio).toFixed(2)}`
                    : "Incluido"}
            </span>
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
    return () => {
      mounted = false;
    };
  }, [restaurantId, comboCtx]);

  // --- LOGIC: Selección ---
  const [sel, setSel] = useState({});

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
        if (max === 1 && currentSet.size >= 1) {
          currentSet.clear();
          currentSet.add(itemId);
        } else if (currentSet.size < max) {
          currentSet.add(itemId);
        } else {
          return prev;
        }
      }
      return { ...prev, [g.id]: currentSet };
    });
  };

  // --- CÁLCULOS ---
  const totalBase = Number(combo?.precio || 0);
  const displayPrice = fmtPEN
    ? fmtPEN(totalBase)
    : `S/ ${totalBase.toFixed(2)}`;

  const validationState = useMemo(() => {
    if (!combo?.grupos?.length)
      return { valid: false, completed: 0, total: 0 };

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
      total: combo.grupos.length,
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
            precio: totalBase,
            cantidad: 1,
            grupos: gruposPayload,
          },
        },
      })
    );
    nav(-1);
  };

  // --- FOOTER SPACING ---
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
    <div className="min-h-screen w-full bg-gray-50/50 text-gray-900">
      <div
        className="mx-auto w-full max-w-5xl"
        style={{ paddingBottom: `calc(${footerHeight}px + 20px)` }}
      >
        {/* HEADER LIMPIO */}
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-4 py-3">
            <div className="flex items-center gap-3">
                <button
                    onClick={() => nav(-1)}
                    className="group flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                >
                    <ArrowLeftIcon className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                        Personalizando
                    </p>
                    <h1 className="truncate text-lg font-bold text-gray-900">
                        {combo?.nombre || "Menú"}
                    </h1>
                </div>
            </div>
            
            {/* Barra de Progreso Integrada en Header */}
            {validationState.total > 0 && (
                <div className="mt-3 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                        <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            style={{
                                width: `${(validationState.completed / validationState.total) * 100}%`,
                            }}
                        />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        {validationState.completed}/{validationState.total}
                    </span>
                </div>
            )}
        </header>

        {/* CONTENIDO PRINCIPAL */}
        <div className="px-4 pt-6">
            {/* ERROR / LOADING */}
            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
                    {error}
                </div>
            )}

            {loading && <ComboSkeleton />}

            {/* LISTA DE GRUPOS */}
            {!loading && !error && combo?.grupos?.length > 0 && (
            <div className="space-y-8">
                {combo.grupos
                .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
                .map((g, idx) => {
                    const selectedSet = sel[g.id] || new Set();
                    const min = Math.max(0, Number(g.min ?? 1));
                    const max = Math.max(1, Number(g.max ?? 1));
                    const isSatisfied = selectedSet.size >= min && selectedSet.size <= max;
                    const remaining = Math.max(0, min - selectedSet.size);

                    return (
                    <section
                        key={g.id}
                        className="animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both"
                        style={{ animationDelay: `${idx * 100}ms` }}
                    >
                        {/* Título del Grupo */}
                        <div className="mb-4 flex items-center justify-between">
                            <div>
                                <h2 className="text-base font-bold text-gray-900 leading-tight">
                                {g.nombre}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {max === 1 ? "Selecciona 1 opción" : `Hasta ${max} opciones`}
                                </p>
                            </div>
                            
                            {/* Badge de estado del grupo */}
                            <div className={cx(
                                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm border",
                                isSatisfied 
                                    ? "bg-emerald-100 border-emerald-200 text-emerald-700" 
                                    : "bg-gray-100 border-gray-200 text-gray-500"
                            )}>
                                {isSatisfied ? (
                                    <>
                                        <CheckIcon className="h-3 w-3" />
                                        <span>Listo</span>
                                    </>
                                ) : (
                                    <span>Faltan {remaining}</span>
                                )}
                            </div>
                        </div>

                        {/* Carrusel Scrolleable */}
                        <div className="-mx-4 px-4 overflow-hidden">
                            <div className="flex gap-3 overflow-x-auto pb-6 pt-1 px-4 -mx-4 scroll-smooth snap-x hide-scrollbar">
                            {(g.items || []).map((item) => {
                                const isSelected = selectedSet.has(item.id);
                                const isMaxReached =
                                !isSelected &&
                                selectedSet.size >= max &&
                                max > 1;

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
                            {/* Espaciador final para que el último item no quede pegado */}
                            <div className="w-2 shrink-0" />
                            </div>
                        </div>
                    </section>
                    );
                })}
            </div>
            )}
        </div>
      </div>

      {/* FOOTER FLOTANTE (Glassmorphism) */}
      <div
        ref={footerRef}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200/60 bg-white/90 backdrop-blur-xl shadow-[0_-4px_20px_rgba(0,0,0,0.05)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto w-full max-w-5xl px-4 py-3">
          <div className="flex items-center gap-4">
            <div className="flex-1 pl-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Total a pagar
              </p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-gray-900 tracking-tight">
                  {displayPrice}
                </span>
              </div>
            </div>

            <button
              onClick={addCombo}
              disabled={!validationState.valid}
              className={cx(
                "relative h-11 overflow-hidden rounded-full px-6 text-sm font-bold text-white shadow-lg transition-all active:scale-95",
                validationState.valid
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/40"
                  : "cursor-not-allowed bg-gray-300 text-gray-500 shadow-none"
              )}
            >
              <span className="relative z-10">
                {validationState.valid ? "Agregar Pedido" : "Completa opciones"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}