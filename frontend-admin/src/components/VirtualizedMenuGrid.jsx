// src/components/VirtualizedMenuGrid.jsx
import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Grid virtualizado para el listado de platos del menú SIN react-window.
 *
 * Props:
 *  - items: array de platos
 *  - renderItem: (item) => ReactNode
 *  - minColumnWidth: ancho mínimo de cada card (px)
 *  - rowHeight: alto aproximado de cada fila (px)
 *  - className: clases extra para el contenedor
 */
export default function VirtualizedMenuGrid({
  items: rawItems,
  renderItem,
  minColumnWidth = 280,
  rowHeight = 340,
  className = "",
}) {
  const items = Array.isArray(rawItems) ? rawItems : [];

  const outerRef = useRef(null); // mide ancho/posición
  const [size, setSize] = useState({ width: 0, height: 600 });
  const [scrollTop, setScrollTop] = useState(0);

  // Medir ancho disponible y altura visible
  useEffect(() => {
    const el = outerRef.current;
    if (!el || typeof window === "undefined") return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      const viewportH = window.innerHeight || 800;

      // Dejamos un margen inferior para no chocar con el footer
      const availableHeight = Math.max(320, viewportH - rect.top - 48);

      setSize((prev) => {
        const next = {
          width: rect.width || 0,
          height: availableHeight,
        };
        if (prev.width === next.width && prev.height === next.height) {
          return prev;
        }
        return next;
      });
    };

    updateSize();

    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    window.addEventListener("resize", updateSize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop || 0);
  }, []);

  const { width, height } = size;

  // Fallback mientras no se ha calculado el width → grid normal (sin virtualizar)
  if (!width) {
    return (
      <div
        ref={outerRef}
        className={
          className ||
          "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        }
      >
        {items.map((item, index) => (
          <div key={item?.id ?? index} className="p-3">
            {renderItem(item)}
          </div>
        ))}
      </div>
    );
  }

  const columnCount = Math.max(1, Math.floor(width / minColumnWidth));
  const columnWidth = Math.floor(width / columnCount);
  const rowCount = Math.ceil(items.length / columnCount);
  const totalHeight = rowCount * rowHeight;

  // Calcular qué filas están visibles según scrollTop
  const OVERSCAN = 2;
  const safeScrollTop = scrollTop || 0;

  const startRow = Math.max(
    0,
    Math.floor(safeScrollTop / rowHeight) - OVERSCAN
  );
  const endRow = Math.min(
    rowCount - 1,
    Math.floor((safeScrollTop + height) / rowHeight) + OVERSCAN
  );

  const startIndex = startRow * columnCount;
  const endIndex = Math.min(items.length, (endRow + 1) * columnCount);

  const children = [];
  for (let index = startIndex; index < endIndex; index++) {
    const item = items[index];
    if (!item) continue;

    const rowIndex = Math.floor(index / columnCount);
    const columnIndex = index % columnCount;

    const top = rowIndex * rowHeight;
    const left = columnIndex * columnWidth;

    children.push(
      <div
        key={item.id ?? index}
        className="p-3"
        style={{
          position: "absolute",
          top,
          left,
          width: columnWidth,
          height: rowHeight,
        }}
      >
        {renderItem(item)}
      </div>
    );
  }

  return (
    <div ref={outerRef} className={className || "w-full"}>
      <div
        style={{
          height,
          overflowY: "auto",
          position: "relative",
        }}
        onScroll={handleScroll}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: totalHeight,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
