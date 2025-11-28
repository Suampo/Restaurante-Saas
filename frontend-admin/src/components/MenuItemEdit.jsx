// src/components/MenuItemEdit.jsx V2
import { useEffect, useMemo, useState } from "react";
import { getCategories } from "../services/categoriesApi";
import {
  Save,
  UploadCloud,
  X,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { proxyImg } from "../utils/imageProxy";

// --- Sub-componente V2 para la carga de imágenes ---
function ImageUploader({ preview, onImageSelect, onClearImage, saving }) {
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onImageSelect(e.dataTransfer.files[0]);
    }
  };

  const src =
    preview && /^https?:\/\//i.test(preview)
      ? proxyImg(preview, 800, 800)
      : preview || null;

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-zinc-700 mb-1">
        Imagen del plato
      </label>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative aspect-square w-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 flex flex-col items-center justify-center text-center transition-colors group hover:border-green-500"
      >
        {src ? (
          <>
            <img
              src={src}
              alt="Vista previa"
              className="absolute inset-0 h-full w-full object-cover rounded-xl"
            />
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white font-semibold">
                Cambiar imagen
              </span>
            </div>
            <button
              type="button"
              onClick={onClearImage}
              disabled={saving}
              title="Quitar imagen"
              className="absolute -top-2 -right-2 p-1 bg-white rounded-full text-zinc-500 hover:text-rose-600 hover:bg-rose-100 shadow-md transition-colors z-10"
            >
              <X size={16} />
            </button>
          </>
        ) : (
          <div className="space-y-1">
            <ImageIcon className="h-10 w-10 mx-auto text-zinc-400" />
            <p className="font-semibold text-green-600">
              Seleccionar un archivo
            </p>
            <p className="text-xs text-zinc-500">o arrastra y suelta</p>
          </div>
        )}
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          onChange={(e) => onImageSelect(e.target.files?.[0] || null)}
          disabled={saving}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        Sugerencia: 800×800px. Máx. 2MB.
      </p>
    </div>
  );
}

// --- COMPONENTE PRINCIPAL V2 ---
export default function MenuItemEdit({
  item,
  onSave,
  onCancel,
  categorias: categoriasProp,
  saving = false,
}) {
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [precio, setPrecio] = useState(item?.precio ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion || "");
  const [imagen, setImagen] = useState(null);
  const [preview, setPreview] = useState(item?.imagen_url || null);
  const [categoriaId, setCategoriaId] = useState(
    item?.categoria_id ?? null
  );
  const [cats, setCats] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);

  const categoriasMemo = useMemo(
    () => (Array.isArray(categoriasProp) ? categoriasProp : cats),
    [categoriasProp, cats]
  );

  useEffect(() => {
    if (Array.isArray(categoriasProp)) return;
    (async () => {
      setLoadingCats(true);
      try {
        const data = await getCategories();
        setCats(Array.isArray(data) ? data : []);
      } finally {
        setLoadingCats(false);
      }
    })();
  }, [categoriasProp]);

  useEffect(() => {
    setNombre(item?.nombre || "");
    setPrecio(item?.precio ?? "");
    setDescripcion(item?.descripcion || "");
    setCategoriaId(item?.categoria_id ?? null);
    setImagen(null);
    setPreview(item?.imagen_url || null);
  }, [item]);

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
    if (!Number.isFinite(p) || p < 0) return alert("El precio no es válido");
    onSave({
      nombre: n,
      precio: p,
      descripcion: (descripcion || "").trim() || null,
      imagen,
      categoriaId: categoriaId ?? null,
    });
  };

  const clearImage = () => {
    const fileInput = document.getElementById("file-upload");
    if (fileInput) fileInput.value = "";
    setImagen(null);
    setPreview(item?.imagen_url || null);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Columna izquierda: imagen */}
        <div className="md:col-span-1">
          <ImageUploader
            preview={preview}
            onImageSelect={setImagen}
            onClearImage={clearImage}
            saving={saving}
          />
        </div>

        {/* Columna derecha: datos */}
        <div className="md:col-span-1 flex flex-col">
          <div className="space-y-4 flex-grow">
            {/* Nombre y precio */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="mi-nombre"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Nombre del plato
                </label>
                <input
                  id="mi-nombre"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  disabled={saving}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div>
                <label
                  htmlFor="mi-precio"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Precio
                </label>
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-sm text-zinc-500">
                    S/
                  </span>
                  <input
                    id="mi-precio"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    required
                    disabled={saving}
                    className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-8 pr-3 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
                  />
                </div>
              </div>
            </div>

            {/* Categoría */}
            <div>
              <label
                htmlFor="mi-categoria"
                className="block text-sm font-medium text-zinc-700"
              >
                Categoría
              </label>
              <select
                id="mi-categoria"
                value={categoriaId != null ? String(categoriaId) : ""}
                onChange={(e) =>
                  setCategoriaId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                disabled={saving || loadingCats}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
              >
                <option value="">— Sin categoría —</option>
                {categoriasMemo.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              {loadingCats && (
                <span className="mt-1 text-xs text-zinc-500">
                  Cargando categorías…
                </span>
              )}
            </div>

            {/* Descripción */}
            <div>
              <label
                htmlFor="mi-descripcion"
                className="block text-sm font-medium text-zinc-700"
              >
                Descripción
              </label>
              <textarea
                id="mi-descripcion"
                rows={4}
                placeholder="Ingredientes, alérgenos, etc. (opcional)"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={saving}
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm transition-colors focus:border-green-500 focus:ring-1 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-zinc-200">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:bg-zinc-100"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-400"
            >
              {saving ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )}
              {saving
                ? "Guardando..."
                : item?.id
                ? "Guardar Cambios"
                : "Crear Plato"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
