import { useEffect, useState } from "react";
import StockView from "./inventario/stock/StockView";
import InsumosView from "./inventario/insumos/InsumosView";
import MovView from "./inventario/movimientos/MovView";
import AlertasView from "./inventario/alertas/AlertasView";
import AlmacenesView from "./inventario/almacenes/AlmacenesView";
import { cls } from "./inventario/utils";

export default function Inventario() {
  const [tab, setTab] = useState(() => {
    if (typeof window === "undefined") return "stock";
    return localStorage.getItem("inv:tab") || "stock";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("inv:tab", tab);
  }, [tab]);

  const tabs = [
    { key: "stock", label: "Stock" },
    { key: "insumos", label: "Insumos" },
    { key: "movimientos", label: "Movimientos" },
    { key: "alertas", label: "Alertas" },
    { key: "almacenes", label: "Almacenes" },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Inventario</h1>

      {/* NAV RESPONSIVE */}
      <nav
        aria-label="Secciones de inventario"
        className="w-full overflow-x-auto sm:overflow-visible"
      >
        <div className="flex gap-2 whitespace-nowrap sm:flex-wrap sm:whitespace-normal">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cls(
                "rounded-lg px-3 py-2 text-xs sm:text-sm transition text-center",
                "border flex-1 sm:flex-none",
                tab === t.key
                  ? "bg-neutral-900 text-white border-neutral-900"
                  : "bg-white hover:bg-neutral-50"
              )}
              aria-current={tab === t.key ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* CONTENIDO */}
      {tab === "stock" && <StockView />}
      {tab === "insumos" && <InsumosView />}
      {tab === "movimientos" && <MovView />}
      {tab === "alertas" && <AlertasView />}
      {tab === "almacenes" && <AlmacenesView />}
    </div>
  );
}
