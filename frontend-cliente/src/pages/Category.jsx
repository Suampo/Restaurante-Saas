import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { FALLBACK_IMG, absolute, formatPEN } from "../App";

export default function Category() {
  const nav = useNavigate();
  const { id } = useParams();
  const { categories } = useMenuPublic();

  const cat = useMemo(() => categories.find((c) => String(c.id) === String(id)), [categories, id]);
  const items = Array.isArray(cat?.items) ? cat.items : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <button onClick={() => nav(-1)} className="mb-3 text-sm text-neutral-900 hover:underline">← Volver</button>
      <h1 className="mb-3 text-xl font-bold text-white">{cat?.nombre ?? "Categoría"}</h1>

      {items.length === 0 ? (
        <div className="rounded-lg border p-6 text-neutral-600">Sin productos en esta categoría.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((item) => (
            <ProductCard
  key={item.id}
  item={item}
  onAdd={(it) => window.dispatchEvent(new CustomEvent("cart:add", { detail: { item: it } }))}
  absolute={absolute}
  fallbackImg={FALLBACK_IMG}
  formatPEN={formatPEN}
  variant="hero"     // ← asegura el modo con imagen a full
/>
          ))}
        </div>
      )}
    </div>
  );
}
