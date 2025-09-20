// src/components/MenuItemEdit.jsx
import { useEffect, useMemo, useState } from "react";
import { getCategories } from "../services/categoriesApi";

export default function MenuItemEdit({
  item,
  onSave,
  categorias: categoriasProp,          // opcional: si el padre ya pasó categorías
  saving = false,                      // opcional: deshabilitar mientras se guarda
}) {
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [precio, setPrecio] = useState(item?.precio ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion || "");
  const [imagen, setImagen] = useState(null);     // File
  const [preview, setPreview] = useState(item?.imagen_url || item?.image_url || null);
  const [categoriaId, setCategoriaId] = useState(item?.categoria_id ?? null); // number | null

  const [cats, setCats] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);

  // Usar categorías del padre si las envía; si no, usar las que carguemos
  const categoriasMemo = useMemo(
    () => (Array.isArray(categoriasProp) ? categoriasProp : cats),
    [categoriasProp, cats]
  );

  // Carga de categorías solo si el padre no las pasó
  useEffect(() => {
    if (Array.isArray(categoriasProp)) return;
    (async () => {
      try {
        setLoadingCats(true);
        const data = await getCategories();
        setCats(Array.isArray(data) ? data : []);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, [categoriasProp]);

  // Resincronizar campos cuando cambia el item (abrir/editar otro plato)
  useEffect(() => {
    setNombre(item?.nombre || "");
    setPrecio(item?.precio ?? "");
    setDescripcion(item?.descripcion || "");
    setCategoriaId(item?.categoria_id ?? null);
    setImagen(null);
    setPreview(item?.imagen_url || item?.image_url || null);
  }, [item]);

  // Preview segura al elegir archivo
  useEffect(() => {
    if (!imagen) return;
    const url = URL.createObjectURL(imagen);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imagen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const n = (nombre || "").trim();
    const p = Number(precio);
    if (!n) return alert("El nombre es requerido");
    if (!Number.isFinite(p)) return alert("El precio no es válido");

    onSave({
      nombre: n,
      precio: p,
      descripcion: (descripcion || "").trim() || null,
      imagen, // File o null
      categoriaId: categoriaId ?? null,
    });
  };

  const clearImage = () => {
    setImagen(null);
    // Si el item tenía imagen previa, dejamos esa preview. Si no, quedará en null.
    setPreview(item?.imagen_url || item?.image_url || null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Fila superior: Nombre + Precio */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="mi-nombre" className="text-sm font-medium text-neutral-800">
            Nombre
          </label>
          <input
            id="mi-nombre"
            className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            disabled={saving}
          />
        </div>

        <div className="grid gap-2">
          <label htmlFor="mi-precio" className="text-sm font-medium text-neutral-800">
            Precio
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-sm text-neutral-500">
              S/
            </span>
            <input
              id="mi-precio"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="w-full rounded-xl border border-neutral-300 bg-white py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500"
              placeholder="0.00"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              required
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {/* Descripción */}
      <div className="grid gap-2">
        <label htmlFor="mi-descripcion" className="text-sm font-medium text-neutral-800">
          Descripción
        </label>
        <textarea
          id="mi-descripcion"
          rows={4}
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          placeholder="Descripción del plato (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          disabled={saving}
        />
      </div>

      {/* Categoría */}
      <div className="grid gap-1.5">
        <label htmlFor="mi-categoria" className="text-sm font-medium text-neutral-800">
          Categoría
        </label>
        <select
          id="mi-categoria"
          className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500"
          value={categoriaId != null ? String(categoriaId) : ""}
          onChange={(e) => setCategoriaId(e.target.value ? Number(e.target.value) : null)}
          disabled={saving}
        >
          <option value="">— Sin categoría —</option>
          {categoriasMemo.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre}
            </option>
          ))}
        </select>
        {loadingCats && (
          <span className="text-xs text-neutral-500">Cargando categorías…</span>
        )}
      </div>

      {/* Imagen */}
      <div className="grid gap-2">
        <label className="text-sm font-medium text-neutral-800">Imagen</label>

        <div className="grid gap-3 md:grid-cols-[112px_1fr]">
          {/* Preview */}
          <div className="flex items-center justify-center">
            <div className="h-24 w-28 overflow-hidden rounded-xl bg-neutral-100 ring-1 ring-black/5">
              {preview ? (
                <img
                  src={preview}
                  alt="Vista previa"
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-xs text-neutral-400">
                  Sin imagen
                </div>
              )}
            </div>
          </div>

          {/* Dropzone/botones */}
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-3">
            <label className="block cursor-pointer rounded-lg border border-neutral-300 bg-white px-3 py-2 text-center text-sm font-medium text-neutral-800 hover:bg-neutral-50">
              Seleccionar archivo
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => setImagen(e.target.files?.[0] || null)}
                disabled={saving}
              />
            </label>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="truncate text-xs text-neutral-600">
                {imagen?.name || ""}
              </div>
              {preview && (
                <button
                  type="button"
                  onClick={clearImage}
                  className="rounded-md border px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                  disabled={saving}
                >
                  Quitar
                </button>
              )}
            </div>

            <p className="mt-2 text-xs text-neutral-500">
              Formatos: JPG/PNG. Tamaño sugerido 800×600. Máx. ~2–3&nbsp;MB.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          disabled={saving}
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
