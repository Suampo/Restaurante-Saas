// src/components/menu/RecommendedCategoriesHint.jsx
import React, { useMemo } from "react";

// normaliza: minúsculas + sin tildes
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

const GROUPS = [
  { key: "extras",  label: "Extras",             keywords: ["extra", "adicional", "topping", "agregado"] },
  { key: "acomps",  label: "Acompañamientos",    keywords: ["acompan", "acompañ", "guarnicion", "side"] },
  { key: "drinks",  label: "Bebidas",            keywords: ["bebida", "gaseosa", "refresco", "drink"] },
];

export default function RecommendedCategoriesHint({ categories = [], onCreateCategory }) {
  const status = useMemo(() => {
    const names = categories.map((c) => norm(c?.nombre));
    const has = (kw) => names.some((n) => kw.some((k) => n.includes(k)));
    return GROUPS.map((g) => ({ ...g, ok: has(g.keywords) }));
  }, [categories]);

  const allOk = status.every((s) => s.ok);
  if (allOk) return null; // ya están creadas; no mostramos nada

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4 text-amber-900" aria-live="polite">
      <div className="mb-2 font-semibold">Sugerencia de categorías para “Recomendados”</div>
      <p className="mb-2 text-sm">
        Para mostrar <span className="font-medium">Extras, Acompañamientos y Bebidas</span> en el detalle de un plato/combo,
        crea (o renombra) categorías cuyos nombres contengan estas palabras.
      </p>

      <ul className="space-y-2">
        {status.map((g) => (
          <li key={g.key} className="flex items-center justify-between gap-3 rounded-lg bg-white/60 p-2.5 ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${g.ok ? "bg-emerald-600" : "bg-neutral-300"}`} />
              <div>
                <div className="text-[13px] font-medium">{g.label}</div>
                <div className="text-[12px] text-neutral-600">
                  Palabras válidas: <em>{g.keywords.join(", ")}</em>
                </div>
              </div>
            </div>

            {typeof onCreateCategory === "function" && !g.ok && (
              <button
                onClick={() => onCreateCategory(g.label)}
                className="rounded-lg border px-3 py-1.5 text-[12px] font-medium text-neutral-800 hover:bg-neutral-50"
              >
                Crear “{g.label}”
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
