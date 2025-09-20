// src/components/CategoriesManager.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryCover,
} from "../services/categoriesApi";

export default function CategoriesManager({ onChange }) {
  // 👇 Skeleton solo en la PRIMERA carga (evita parpadeos posteriores)
  const [loadingInitial, setLoadingInitial] = useState(true);

  const [cats, setCats] = useState([]);
  const [nombre, setNombre] = useState("");
  const [busyId, setBusyId] = useState(null); // id en acción (subir/renombrar/eliminar)
  const [imgVer, setImgVer] = useState({});   // id -> timestamp para bustear <img>

  const shallowEqualCats = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i], y = b[i];
      if (x?.id !== y?.id || x?.nombre !== y?.nombre || x?.cover_url !== y?.cover_url) return false;
    }
    return true;
  };

  // Notificación al padre (si la pide) evitando repetir la misma lista
  const notifyChange = useRef(null);
  if (!notifyChange.current) {
    notifyChange.current = (list) => {
      if (onChange && !shallowEqualCats(onChange.__last || [], list)) {
        onChange(list);
        onChange.__last = list;
      }
    };
  }

  // Carga inicial (con skeleton)
  const fetchInitial = useCallback(async () => {
    try {
      const c = await getCategories();
      const list = Array.isArray(c) ? c : [];
      setCats(list);
      notifyChange.current(list);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  // Refresh silencioso (sin skeleton)
  const refreshQuiet = useCallback(async () => {
    try {
      const c = await getCategories();
      const list = Array.isArray(c) ? c : [];
      setCats(list);
      notifyChange.current(list);
    } catch {
      /* opcional: console.warn("refreshQuiet failed") */
    }
  }, []);

  // Evita doble fetch en StrictMode
  const initRan = useRef(false);
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    fetchInitial();
  }, [fetchInitial]);

  // Helpers de actualización local (optimista)
  const patchCat = (id, patch) =>
    setCats((prev) => prev.map((c) => (c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c)));

  const removeLocal = (id) =>
    setCats((prev) => prev.filter((c) => c.id !== id));

  const addLocal = (cat) =>
    setCats((prev) => [cat, ...prev]);

  // ── Acciones ─────────────────────────────────────────────

  const add = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;

    setBusyId("new");

    // Optimista: placeholder por si el backend tarda
    const tempId = `tmp-${Date.now()}`;
    addLocal({ id: tempId, nombre: n, cover_url: "" });

    try {
      const created = await createCategory(n);
      // Si el backend devuelve la categoría creada, reemplazamos el temp
      if (created && created.id) {
        setCats((prev) =>
          prev.map((c) => (c.id === tempId ? created : c))
        );
      }
      setNombre("");
      // Normalizar con un refresh silencioso
      refreshQuiet();
    } catch (e2) {
      // Revertir placeholder
      removeLocal(tempId);
      alert(e2?.response?.data?.error || "No se pudo crear la categoría");
      console.error("createCategory:", e2?.response?.data || e2.message);
    } finally {
      setBusyId(null);
    }
  };

  const rename = async (cat) => {
    const nuevo = prompt("Nuevo nombre de categoría", cat?.nombre || "");
    if (!nuevo?.trim()) return;

    const oldName = cat.nombre;
    const newName = nuevo.trim();

    setBusyId(cat.id);
    // Optimista
    patchCat(cat.id, { nombre: newName });

    try {
      await updateCategory(cat.id, newName);
      // Sincroniza sin skeleton
      refreshQuiet();
    } catch (e2) {
      // Revertimos nombre
      patchCat(cat.id, { nombre: oldName });
      alert(e2?.response?.data?.error || "No se pudo renombrar");
      console.error("updateCategory:", e2?.response?.data || e2.message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (cat) => {
    if (!confirm(`¿Eliminar "${cat?.nombre}"? (los platos quedarán sin categoría)`)) return;

    setBusyId(cat.id);
    // Optimista
    const prev = cats;
    removeLocal(cat.id);

    try {
      await deleteCategory(cat.id);
      refreshQuiet();
    } catch (e2) {
      // Revertir lista
      setCats(prev);
      alert(e2?.response?.data?.error || "No se pudo eliminar");
      console.error("deleteCategory:", e2?.response?.data || e2.message);
    } finally {
      setBusyId(null);
    }
  };

  const onPick = async (id, ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;

    setBusyId(id);

    // Optimista: bustear la URL actual con timestamp
    const stamp = Date.now();
    patchCat(id, (c) => {
      const base = c.cover_url || "";
      return base
        ? { cover_url: `${base}${base.includes("?") ? "&" : "?"}_ts=${stamp}` }
        : {};
    });

    try {
      const updated = await uploadCategoryCover(id, file); // si devuelve { cover_url }, úsalo
      if (updated && updated.cover_url) {
        patchCat(id, { cover_url: updated.cover_url });
      } else {
        // Si el backend mantiene la misma URL física, forzamos re-render
        setImgVer((v) => ({ ...v, [id]: Date.now() }));
      }
      refreshQuiet();
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo subir la imagen");
      console.error("uploadCategoryCover:", e2?.response?.data || e2.message);
    } finally {
      setBusyId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5" aria-busy={loadingInitial ? "true" : "false"}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold">Categorías</h3>
      </div>

      {/* Alta de categoría */}
      <form onSubmit={add} className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          id="new-category"
          name="category_name"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          placeholder="Nueva categoría (ej. Pizzas)"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          autoComplete="off"
        />
        <button
          type="submit"
          className="h-10 rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
          disabled={!nombre.trim() || busyId === "new"}
        >
          {busyId === "new" ? "Agregando…" : "Agregar"}
        </button>
      </form>

      {/* Lista */}
      <div className="space-y-2">
        {loadingInitial ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-neutral-100" />
          ))
        ) : cats.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin categorías.</p>
        ) : (
          cats.map((c) => {
            const hasCover = typeof c.cover_url === "string" && c.cover_url.trim() !== "";
            const pending  = busyId === c.id;
            const ver      = imgVer[c.id];
            const src      = hasCover
              ? c.cover_url + (ver ? (c.cover_url.includes("?") ? "&" : "?") + "v=" + ver : "")
              : null;

            const inputId = `cat-file-${c.id}`;

            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded bg-neutral-100 ring-1 ring-black/5">
                    {hasCover ? (
                      <img
                        src={src}
                        alt={c.nombre}
                        className="h-full w-full object-cover"
                        width={80}
                        height={48}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="h-full w-full" />
                    )}
                  </div>
                  <span className="truncate text-sm">
                    {c.nombre} {pending && <span className="text-xs text-neutral-500">· procesando…</span>}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <input
                    id={inputId}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={pending}
                    onChange={(e) => onPick(c.id, e)}
                  />
                  <label
                    htmlFor={inputId}
                    className="cursor-pointer rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-60"
                    aria-disabled={pending}
                  >
                    Imagen
                  </label>

                  <button
                    type="button"
                    onClick={() => rename(c)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-neutral-50 disabled:opacity-60"
                    disabled={pending}
                  >
                    Renombrar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    className="rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-700 hover:bg-red-100 disabled:opacity-60"
                    disabled={pending}
                  >
                    Eliminar
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
