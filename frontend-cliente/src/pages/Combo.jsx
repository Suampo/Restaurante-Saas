import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../lib/ui.js";

function cx(...arr) { return arr.filter(Boolean).join(" "); }

function CheckBadge({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cx("h-5 w-5", className)} fill="currentColor">
      <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm-1.03 13.03-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 4.886-5.02a1 1 0 1 1 1.45 1.378l-5.58 5.763a1.5 1.5 0 0 1-2.464 0Z" />
    </svg>
  );
}

function SelectCard({ data, active, onClick }) {
  const API_BASE = import.meta.env.VITE_API_PEDIDOS || import.meta.env.VITE_API_URL || "http://localhost:4000";
  const img = absolute(API_BASE, data?.imagen_url) || FALLBACK_IMG;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group relative w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm ring-1 ring-black/5 transition-all duration-200",
        active ? "ring-2 ring-emerald-500 shadow-md scale-[1.02]" : "hover:shadow-md hover:-translate-y-[2px]"
      )}
    >
      <div className="relative">
        <img
          src={img}
          onError={(e) => (e.currentTarget.src = FALLBACK_IMG)}
          alt={data?.nombre || "Item"}
          className="h-36 w-full object-cover md:h-40 lg:h-44"
        />
        {active && (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-emerald-600/95 px-2 py-1 text-xs font-medium text-white shadow">
            <CheckBadge className="h-4 w-4 text-white" /> Seleccionado
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="line-clamp-2 text-sm font-semibold text-neutral-900">
          {data?.nombre}
        </div>
        {data?.descripcion && (
          <div className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
            {data.descripcion}
          </div>
        )}
      </div>
    </button>
  );
}

export default function Combo() {
  const nav = useNavigate();
  const { combos = [], categories = [], loading, error } = useMenuPublic();
  const combo = combos?.[0] || null;

  const getItemsByCategory = useCallback(
    (name) => {
      const c = categories.find(
        (x) => String(x?.nombre || "").toLowerCase().trim() === name
      );
      return Array.isArray(c?.items) ? c.items : [];
    },
    [categories]
  );

  const entradas = useMemo(() => getItemsByCategory("entrada"), [getItemsByCategory]);
  const fondos   = useMemo(() => getItemsByCategory("fondo"),   [getItemsByCategory]);

  const [entrada, setEntrada] = useState(null);
  const [fondo, setFondo] = useState(null);

  const complete = !!(entrada && fondo);
  const total = Number(combo?.precio || 0);

  const addCombo = () => {
    if (!complete) return;
    window.dispatchEvent(
      new CustomEvent("cart:add", {
        detail: {
          item: {
            isCombo: true,
            comboId: combo?.id,
            nombreCombo: combo?.nombre || "Menú",
            precio: total,
            entrada,
            plato: fondo,
            cantidad: 1,
          },
        },
      })
    );
    nav(-1);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6">
      <button onClick={() => nav(-1)} className="mb-4 text-sm text-emerald-700 hover:underline">
        ← Volver
      </button>

      <div className="mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">
          {combo?.nombre || "Menú del día"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Elige <b>1 entrada</b> + <b>1 fondo</b> — <span className="font-semibold">{formatPEN(total)}</span>
        </p>
      </div>

      {loading && <div className="rounded-lg border bg-white p-5 text-neutral-600">Cargando opciones...</div>}
      {error && !loading && <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>}

      {!loading && !error && (
        <>
          <section className="mt-6 animate-fadeInUp">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">Entradas</h2>
            {entradas.length === 0 ? (
              <div className="rounded-lg border bg-white p-5 text-neutral-600">No hay entradas disponibles.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {entradas.map((e) => (
                  <SelectCard key={e.id} data={e} active={entrada?.id === e.id} onClick={() => setEntrada(e)} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-8 animate-fadeInUp">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">Fondos</h2>
            {fondos.length === 0 ? (
              <div className="rounded-lg border bg-white p-5 text-neutral-600">No hay fondos disponibles.</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {fondos.map((f) => (
                  <SelectCard key={f.id} data={f} active={fondo?.id === f.id} onClick={() => setFondo(f)} />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Footer sticky */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-6xl px-4 pb-[max(env(safe-area-inset-bottom),0px)]">
          <div className="mb-3 overflow-hidden rounded-2xl border bg-white/90 shadow-xl backdrop-blur-md">
            <div className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-50 text-emerald-700">🧾</div>
                <div className="min-w-0">
                  <div className="truncate text-sm text-neutral-700">
                    {complete ? (
                      <>Listo para agregar — <span className="font-semibold">{formatPEN(total)}</span></>
                    ) : (
                      <>
                        {entrada ? "Elige un fondo" : "Elige una entrada"} ·{" "}
                        <span className="font-medium">Total: {formatPEN(total)}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => nav(-1)} className="hidden rounded-xl border px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 md:block">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={addCombo}
                  disabled={!complete}
                  className={cx(
                    "rounded-xl px-5 py-2 text-sm font-semibold shadow-sm transition-all",
                    complete ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-neutral-200 text-neutral-600 cursor-not-allowed"
                  )}
                >
                  Agregar combo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
