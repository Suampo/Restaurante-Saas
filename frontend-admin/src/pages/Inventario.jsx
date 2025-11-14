import { useEffect, useState } from "react";
import StockView from "./inventario/stock/StockView";
import InsumosView from "./inventario/insumos/InsumosView";
import MovView from "./inventario/movimientos/MovView";
import AlertasView from "./inventario/alertas/AlertasView";
import AlmacenesView from "./inventario/almacenes/AlmacenesView";
import { cls } from "./inventario/utils";

export default function Inventario() {
  const [tab, setTab] = useState(() => localStorage.getItem("inv:tab") || "stock");
  useEffect(() => localStorage.setItem("inv:tab", tab), [tab]);

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

      <nav aria-label="Secciones de inventario" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cls(
              "rounded-lg px-3 py-1.5 text-sm transition",
              tab === t.key ? "bg-neutral-900 text-white" : "border hover:bg-neutral-50"
            )}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "stock" && <StockView />}
      {tab === "insumos" && <InsumosView />}
      {tab === "movimientos" && <MovView />}
      {tab === "alertas" && <AlertasView />}
      {tab === "almacenes" && <AlmacenesView />}
    </div>
  );
}
