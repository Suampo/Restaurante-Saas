// src/components/ComboManager.jsx
import { useEffect, useMemo, useState } from "react";
import {
  getCombos,
  createCombo,
  updateCombo,
  deleteCombo,
  uploadComboCover,
} from "../services/combosApi";

export default function ComboManager({ cats: externalCats = [] }) {
  const [cats, setCats] = useState(externalCats);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [catEntrada, setCatEntrada] = useState("");
  const [catPlato, setCatPlato] = useState("");

  const catNameById = useMemo(
    () => Object.fromEntries((cats || []).map((c) => [c.id, c.nombre])),
    [cats]
  );

  useEffect(() => {
    setCats(Array.isArray(externalCats) ? externalCats : []);
  }, [externalCats]);

  const load = async () => {
    setLoading(true);
    try {
      const co = await getCombos();
      setCombos(Array.isArray(co) ? co : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const add = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    const p = Number(precio);
    if (!n) return alert("Ingresa un nombre.");
    if (!Number.isFinite(p) || p < 0) return alert("Precio inválido.");
    if (!catEntrada || !catPlato) return alert("Selecciona ambas categorías.");
    try {
      setSaving(true);
      await createCombo({
        nombre: n,
        precio: p,
        categoriaEntradaId: Number(catEntrada),
        categoriaPlatoId: Number(catPlato),
        activo: true,
      });
      setNombre("");
      setPrecio("");
      setCatEntrada("");
      setCatPlato("");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const rename = async (id) => {
    const cur = combos.find((x) => x.id === id);
    const nuevo = prompt("Nombre del combo", cur?.nombre || "");
    if (!nuevo?.trim()) return;
    await updateCombo(id, { nombre: nuevo.trim() });
    await load();
  };

  const changePrice = async (id) => {
    const cur = combos.find((x) => x.id === id);
    const txt = prompt("Nuevo precio", String(cur?.precio ?? ""));
    if (txt == null) return;
    const p = Number(txt);
    if (!Number.isFinite(p) || p < 0) return alert("Precio inválido.");
    await updateCombo(id, { precio: p });
    await load();
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar combo? Esta acción no se puede deshacer.")) return;
    try {
      setDeletingId(id);
      await deleteCombo(id);
      setCombos((prev) => prev.filter((c) => c.id !== id));
    } catch {
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const pickCover = async (id, file) => {
    if (!file) return;
    try {
      setUploadingId(id);
      const res = await uploadComboCover(id, file); // { id, nombre, cover_url }
      setCombos((prev) =>
        prev.map((x) => (x.id === id ? { ...x, cover_url: res.cover_url } : x))
      );
    } catch (e) {
      console.error(e);
      alert("No se pudo subir la imagen");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Combos (Menú del día)</h3>
      </div>

      {/* Form crear */}
      <form onSubmit={add} className="mb-3 grid gap-2 sm:grid-cols-2 md:grid-cols-4">
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Nombre del combo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          disabled={saving}
        />
        <input
          type="number"
          step="0.01"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Precio (S/)"
          value={precio}
          onChange={(e) => setPrecio(e.target.value)}
          disabled={saving}
        />
        <select
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          value={catEntrada}
          onChange={(e) => setCatEntrada(e.target.value)}
          disabled={saving}
        >
          <option value="">— Categoría 1 (entrada) —</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <select
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          value={catPlato}
          onChange={(e) => setCatPlato(e.target.value)}
          disabled={saving}
        >
          <option value="">— Categoría 2 (plato) —</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <div className="sm:col-span-2 md:col-span-4">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Creando…" : "Crear combo"}
          </button>
        </div>
      </form>

      {/* Listado */}
      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))
        ) : combos.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin combos.</p>
        ) : (
          combos.map((co) => {
            const c1Id = co.categoria_entrada_id ?? co.categoriaEntradaId;
            const c2Id = co.categoria_plato_id ?? co.categoriaPlatoId;
            const hasCover =
              typeof co.cover_url === "string" && co.cover_url.trim().length > 0;

            return (
              // Grid 2 columnas + fila inferior para botones (col-span-2)
              <div
                key={co.id}
                className="grid grid-cols-[88px_1fr] items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                {/* Columna IZQ: imagen */}
                <div className="flex items-start justify-center">
                  <div className="h-16 w-16 overflow-hidden rounded-lg bg-neutral-100 ring-1 ring-black/5">
                    {hasCover ? (
                      <img
                        src={co.cover_url}
                        alt={co.nombre}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                </div>

                {/* Columna DER: MENÚ · Precio · Chips */}
                <div className="min-w-0">
                  <div className="inline-flex flex-wrap items-center gap-2 text-sm">
                    <span className="truncate max-w-[14rem] font-medium">{co.nombre}</span>
                    <span className="text-neutral-400">·</span>
                    <span className="whitespace-nowrap text-neutral-600">
                      Precio:{" "}
                      <span className="font-medium">
                        S/ {Number(co.precio || 0).toFixed(2)}
                      </span>
                    </span>
                    <span className="text-neutral-400">·</span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 ring-1 ring-neutral-200">
                        {catNameById[c1Id] || "Entrada"}
                      </span>
                      <span className="text-[11px] text-neutral-400">+</span>
                      <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 ring-1 ring-neutral-200">
                        {catNameById[c2Id] || "Fondo"}
                      </span>
                    </span>
                    {uploadingId === co.id && (
                      <span className="ml-1 text-xs text-neutral-500 whitespace-nowrap">
                        Subiendo…
                      </span>
                    )}
                  </div>
                </div>

                {/* Fila inferior: BOTONES en línea, abarcando ambas columnas */}
                <div className="col-span-2 mt-2 flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50">
                    Imagen
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) => pickCover(co.id, e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => rename(co.id)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50"
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => changePrice(co.id)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50"
                  >
                    Precio
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(co.id)}
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                    disabled={deletingId === co.id}
                  >
                    {deletingId === co.id ? "Eliminando…" : "Eliminar"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
