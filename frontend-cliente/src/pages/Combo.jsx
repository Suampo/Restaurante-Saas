// src/pages/Combo.jsx
import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";
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

function cx(...a) {
  return a.filter(Boolean).join(" ");
}

/* ===== helpers ===== */
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

/* Iconitos inline para el footer */
const Check = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);
const Alert = (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v5m0 4h.01" />
  </svg>
);

export default function Combo() {
  const nav = useNavigate();
  const { combos = [], restaurantId } = useMenuPublic();

  const qs = new URLSearchParams(location.search);
  const comboIdQ = qs.get("comboId");

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

  useEffect(() => {
    let on = true;
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
        setCombo(full ? { ...comboCtx, ...full } : comboCtx || null);
      } catch {
        setError("No se pudo cargar el combo.");
      } finally {
        on && setLoading(false);
      }
    }
    load();
    return () => {
      on = false;
    };
  }, [restaurantId, comboCtx]);

  // ===== selección por grupo =====
  const [sel, setSel] = useState({});
  useEffect(() => {
    setSel({});
  }, [combo?.id]);

  const toggle = (g, itemId) => {
    setSel((prev) => {
      const cur = new Set(prev[g.id] || []);
      if (cur.has(itemId)) cur.delete(itemId);
      else {
        const max = Math.max(1, Number(g.max ?? 1));
        if (cur.size >= max) return prev;
        cur.add(itemId);
      }
      return { ...prev, [g.id]: cur };
    });
  };

  const total = Number(combo?.precio || 0);
  const priceLabel = fmtPEN ? fmtPEN(total) : `S/ ${total.toFixed(2)}`;

  const isValid = useMemo(() => {
    if (!combo?.grupos?.length) return false;
    for (const g of combo.grupos) {
      const c = sel[g.id]?.size ?? 0;
      const min = Math.max(0, Number(g.min ?? 1));
      const max = Math.max(1, Number(g.max ?? 1));
      if (c < min || c > max) return false;
    }
    return true;
  }, [combo, sel]);

  const completed = useMemo(() => {
    if (!combo?.grupos?.length) return 0;
    let ok = 0;
    for (const g of combo.grupos) {
      const c = sel[g.id]?.size ?? 0;
      const min = Math.max(0, Number(g.min ?? 1));
      const max = Math.max(1, Number(g.max ?? 1));
      if (c >= min && c <= max) ok += 1;
    }
    return ok;
  }, [combo, sel]);
  const totalGroups = combo?.grupos?.length || 0;

  const addCombo = () => {
    if (!combo) return;
    const grupos = (combo.grupos || []).map((g) => ({
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
            precio: total,
            cantidad: 1,
            grupos,
          },
        },
      })
    );
    nav(-1);
  };

  /* ===== Footer safe area (medido) ===== */
  const footerRef = useRef(null);
  const [footerH, setFooterH] = useState(88); // altura compacta por defecto

  useLayoutEffect(() => {
    const measure = () =>
      setFooterH((footerRef.current?.offsetHeight || 0)); // sin sumar extras
    measure();
    const ro = new ResizeObserver(measure);
    if (footerRef.current) ro.observe(footerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 pt-6"
      style={{
        // Reserva EXACTA del footer + barra del carrito; 8px de respiro
        paddingBottom: `calc(${Math.max(footerH, 72) + 8}px + var(--cart-bar-h, 0px))`,
      }}
    >
      <button
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        ← Volver
      </button>

      {/* HERO con imagen o gradiente */}
      <div className="relative mb-4 overflow-hidden rounded-2xl ring-1 ring-black/5">
        {!heroImg && (
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 380px at -10% -10%, rgba(255,255,255,.14) 0%, transparent 60%)," +
                "radial-gradient(700px 360px at 115% -15%, rgba(255,255,255,.12) 0%, transparent 55%)," +
                "linear-gradient(135deg,#059669 0%,#047857 48%,#0ea5e9 100%)",
            }}
          />
        )}
        {heroImg && (
          <img
            src={heroImg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-black/15 to-transparent" />
        <div className="relative px-4 py-4 sm:px-5 sm:py-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
            {combo?.nombre || "Menú del día"}
          </h1>
          <p className="mt-1 text-sm text-white/95 drop-shadow">
            Selecciona los ítems requeridos —{" "}
            <span className="font-semibold">{priceLabel}</span>
          </p>
          {totalGroups > 0 && (
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-white/25">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{ width: `${(completed / totalGroups) * 100}%` }}
                />
              </div>
              <div className="mt-1 text-right text-[12px] font-medium text-white/95 drop-shadow">
                {completed}/{totalGroups} completados
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mb-4 text-sm text-neutral-600">
        Selecciona los ítems requeridos por grupo ·{" "}
        <span className="font-semibold">{priceLabel}</span>
      </p>

      {loading && (
        <div className="rounded-lg border bg-white p-5 text-neutral-600">
          Cargando opciones…
        </div>
      )}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && combo?.grupos?.length > 0 && (
        <div className="space-y-8">
          {combo.grupos
            .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
            .map((g) => {
              const selected = sel[g.id] || new Set();
              const min = Math.max(0, Number(g.min ?? 1));
              const max = Math.max(1, Number(g.max ?? 1));
              const ok = selected.size >= min && selected.size <= max;

              return (
                <section key={g.id} className="animate-fadeInUp">
                  <header className="mb-2 flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-neutral-900">
                      {g.nombre}
                    </h2>
                    <span
                      className={cx(
                        "text-xs rounded-full px-2 py-0.5",
                        ok
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
                      )}
                    >
                      min {min} · max {max} · {selected.size} seleccionados
                    </span>
                  </header>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {(g.items || []).map((it) => {
                      const on = selected.has(it.id);
                      const disable = !on && selected.size >= max;
                      return (
                        <button
                          key={it.id}
                          onClick={() => !disable && toggle(g, it.id)}
                          disabled={disable}
                          className={cx(
                            "group relative overflow-hidden rounded-2xl bg-white text-left shadow-sm transition",
                            on
                              ? "ring-2 ring-emerald-500 shadow-md scale-[1.01]"
                              : "ring-1 ring-neutral-200/70 hover:ring-neutral-300 hover:shadow-md hover:-translate-y-[1px]",
                            disable && "opacity-50 cursor-not-allowed"
                          )}
                        >
                          <div className="relative">
                            <img
                              src={absolute(it.imagen_url) || FALLBACK_IMG}
                              onError={(e) =>
                                (e.currentTarget.src = FALLBACK_IMG)
                              }
                              alt={it?.nombre || "Item"}
                              className="h-36 w-full object-cover md:h-40 lg:h-44"
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                          <div className="p-3">
                            <div className="line-clamp-2 text-sm font-semibold text-neutral-900">
                              {it.nombre}
                            </div>
                            <div className="mt-0.5 text-xs text-neutral-500">
                              S/ {Number(it.precio || 0).toFixed(2)}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      )}

      {/* ===== Footer sticky (compacto y sin espacio extra) ===== */}
      <div
        ref={footerRef}
        className="fixed inset-x-0 z-40"
        style={{ bottom: "var(--cart-bar-h, 0px)" }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/95 shadow-[0_10px_38px_-12px_rgba(0,0,0,.35)] backdrop-blur supports-[backdrop-filter]:backdrop-blur-md">
            <div className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  {isValid ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Alert className="h-4 w-4 text-amber-600" />
                  )}
                  <span
                    className={cx(
                      "leading-none",
                      isValid ? "text-emerald-700 font-medium" : "text-neutral-700"
                    )}
                  >
                    {isValid
                      ? "¡Listo para agregar!"
                      : "Completa las selecciones requeridas"}
                  </span>
                </div>
                <div className="mt-0.5 text-[13px] text-neutral-500">
                  Total{" "}
                  <span className="font-semibold text-neutral-900">
                    {priceLabel}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={addCombo}
                disabled={!isValid}
                className={cx(
                  "h-11 rounded-xl px-5 text-sm font-semibold shadow-sm transition-all",
                  isValid
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                )}
              >
                Agregar combo
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
