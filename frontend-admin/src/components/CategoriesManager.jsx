// src/components/CategoriesManager.jsx
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryCover,
} from "../services/categoriesApi";
import EditModal from "./EditModal";
import ConfirmationModal from "./ConfirmationModal";
import RecommendedCategoriesHint from "./menu/RecommendedCategoriesHint";

// --- Iconos para usar en el componente ---
const Icon = ({ name, className = "h-5 w-5" }) => {
  const icons = {
    add: (
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    ),
    image: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.65-1.65l1.65-1.65a2.25 2.25 0 013.182 0l3.3 3.3V5.25A2.25 2.25 0 0018 3H6a2.25 2.25 0 00-2.25 2.25v10.5z"
      />
    ),
    edit: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
      />
    ),
    trash: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.036-2.134H8.718c-1.126 0-2.037.955-2.037 2.134v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    ),
  };
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      {icons[name]}
    </svg>
  );
};

export default function CategoriesManager({ onChange }) {
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [cats, setCats] = useState([]);
  const [nombre, setNombre] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [imgVer, setImgVer] = useState({});

  // --- Estado unificado para todos los modales ---
  const [modalState, setModalState] = useState({
    type: null, // 'rename', 'delete', 'conflict'
    data: null,
  });

  // ===== notificación a padre =====
  const shallowEqualCats = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i],
        y = b[i];
      if (x?.id !== y?.id || x?.nombre !== y?.nombre || x?.cover_url !== y?.cover_url) return false;
    }
    return true;
  };
  const notifyChange = useRef(null);
  if (!notifyChange.current) {
    notifyChange.current = (list) => {
      if (onChange && !shallowEqualCats(onChange.__last || [], list)) {
        onChange(list);
        onChange.__last = list;
      }
    };
  }

  // ===== fetch inicial y refresh =====
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

  const refreshQuiet = useCallback(async () => {
    try {
      const c = await getCategories();
      const list = Array.isArray(c) ? c : [];
      setCats(list);
      notifyChange.current(list);
    } catch {
      /* noop */
    }
  }, []);

  const initRan = useRef(false);
  useEffect(() => {
    if (initRan.current) return;
    initRan.current = true;
    fetchInitial();
  }, [fetchInitial]);

  // helpers mutación local
  const patchCat = (id, patch) =>
    setCats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c))
    );
  const removeLocal = (id) => setCats((prev) => prev.filter((c) => c.id !== id));
  const addLocal = (cat) => setCats((prev) => [cat, ...prev]);

  // ===== crear desde el formulario =====
  const add = async (e) => {
    e.preventDefault();
    const n = nombre.trim();
    if (!n) return;
    setBusyId("new");
    const tempId = `tmp-${Date.now()}`;
    addLocal({ id: tempId, nombre: n, cover_url: "" });
    try {
      const created = await createCategory(n);
      if (created?.id) setCats((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      setNombre("");
      refreshQuiet();
    } catch (e2) {
      removeLocal(tempId);
      alert(e2?.response?.data?.error || "No se pudo crear la categoría");
    } finally {
      setBusyId(null);
    }
  };

  // ===== crear sugerida desde el banner =====
  const createSuggested = async (name) => {
    const n = String(name || "").trim();
    if (!n) return;
    const exists = cats.some((c) => String(c?.nombre || "").toLowerCase().includes(n.toLowerCase()));
    if (exists) return; // ya existe algo equivalente
    const tempId = `tmp-${Date.now()}`;
    setBusyId(`suggest:${n}`);
    addLocal({ id: tempId, nombre: n, cover_url: "" });
    try {
      const created = await createCategory(n);
      if (created?.id) setCats((prev) => prev.map((c) => (c.id === tempId ? created : c)));
      refreshQuiet();
    } catch (e) {
      removeLocal(tempId);
      alert(e?.response?.data?.error || "No se pudo crear la categoría sugerida");
    } finally {
      setBusyId(null);
    }
  };

  // ===== acciones =====
  const handleRename = async (newName) => {
    const cat = modalState.data;
    if (!cat || !newName?.trim()) return;
    const oldName = cat.nombre;
    const newNameTrimmed = newName.trim();
    setBusyId(cat.id);
    patchCat(cat.id, { nombre: newNameTrimmed });
    try {
      await updateCategory(cat.id, newNameTrimmed);
      refreshQuiet();
    } catch (e2) {
      patchCat(cat.id, { nombre: oldName });
      alert(e2?.response?.data?.error || "No se pudo renombrar");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async () => {
    const cat = modalState.data;
    if (!cat) return;
    setBusyId(cat.id);
    const prev = cats;
    removeLocal(cat.id);
    try {
      await deleteCategory(cat.id);
      refreshQuiet();
    } catch (e2) {
      setCats(prev);
      if (e2?.response?.status === 409) {
        const d = e2.response.data?.detail || {};
        setModalState({
          type: "conflict",
          data: {
            catId: cat.id,
            catName: cat.nombre,
            inCombos: Number(d.inCombos ?? 0),
            inMenuItems: Number((d.inMenuItems ?? d.inPlatos) || 0),
          },
        });
      } else {
        alert(e2?.response?.data?.error || "No se pudo eliminar");
      }
    } finally {
      setBusyId(null);
    }
  };

  const forceDelete = async () => {
    const { data } = modalState;
    if (!data) return;
    try {
      await deleteCategory(data.catId, { force: true });
      refreshQuiet();
      alert("Categoría eliminada con éxito.");
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo forzar la eliminación");
    }
  };

  const onPick = async (id, ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setBusyId(id);
    const stamp = Date.now();
    patchCat(id, (c) => {
      const base = c.cover_url || "";
      return base
        ? { cover_url: `${base}${base.includes("?") ? "&" : "?"}_ts=${stamp}` }
        : {};
    });
    try {
      const updated = await uploadCategoryCover(id, file);
      if (updated?.cover_url) patchCat(id, { cover_url: updated.cover_url });
      else setImgVer((v) => ({ ...v, [id]: Date.now() }));
      refreshQuiet();
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo subir la imagen");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-6">
        <h3 className="text-lg font-bold text-gray-900">Categorías</h3>
        <p className="mt-1 mb-6 text-sm text-gray-600">
          Organiza tus platos en grupos para una mejor navegación en el menú.
        </p>

        {/* --- Formulario de creación --- */}
        <form onSubmit={add} className="mb-4 flex gap-3">
          <input
            className="w-full rounded-lg border-gray-300 px-4 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            placeholder="Nombre de la nueva categoría (sugeridas: Extras, Acompañamientos, Bebidas)"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="off"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-60"
            disabled={!nombre.trim() || busyId === "new"}
          >
            <Icon name="add" className="h-4 w-4" />
            <span>{busyId === "new" ? "Agregando…" : "Agregar"}</span>
          </button>
        </form>

        {/* --- Aviso de categorías recomendadas (Extras / Acompañamientos / Bebidas) --- */}
        <RecommendedCategoriesHint
          categories={cats}
          onCreateCategory={createSuggested}
        />

        {/* --- Lista de categorías --- */}
        <div className="mt-4 space-y-3">
          {loadingInitial ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-xl bg-gray-100" />
            ))
          ) : cats.length === 0 ? (
            <div className="text-center rounded-lg border-2 border-dashed border-gray-300 p-8">
              <p className="text-sm text-gray-500">Aún no has creado ninguna categoría.</p>
            </div>
          ) : (
            cats.map((c) => {
              const hasCover =
                typeof c.cover_url === "string" && c.cover_url.trim() !== "";
              const pending = busyId === c.id;
              const ver = imgVer[c.id];
              const src = hasCover
                ? c.cover_url +
                  (ver ? (c.cover_url.includes("?") ? "&" : "?") + "v=" + ver : "")
                : null;
              const inputId = `cat-file-${c.id}`;

              return (
                <div
                  key={c.id}
                  className="flex items-center rounded-xl p-3 transition-colors hover:bg-gray-50"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-100 ring-1 ring-black/5">
                      {hasCover ? (
                        <img src={src} alt={c.nombre} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-gray-400">
                          <Icon name="image" className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <span className="truncate text-sm font-medium text-gray-800">
                      {c.nombre}{" "}
                      {pending && (
                        <span className="ml-2 animate-pulse text-xs font-normal text-gray-500">
                          procesando…
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
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
                      className="cursor-pointer rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-200"
                      aria-disabled={pending}
                      title="Cambiar imagen"
                    >
                      <Icon name="image" className="h-4 w-4" />
                    </label>
                    <button
                      type="button"
                      onClick={() => setModalState({ type: "rename", data: c })}
                      className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-200"
                      disabled={pending}
                      title="Renombrar"
                    >
                      <Icon name="edit" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalState({ type: "delete", data: c })}
                      className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-100"
                      disabled={pending}
                      title="Eliminar"
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- Modales --- */}
      <EditModal
        isOpen={modalState.type === "rename"}
        onClose={() => setModalState({ type: null, data: null })}
        onSave={handleRename}
        title="Renombrar Categoría"
        label="Nuevo nombre para la categoría"
        initialValue={modalState.data?.nombre || ""}
      />

      <ConfirmationModal
        isOpen={modalState.type === "delete"}
        onClose={() => setModalState({ type: null, data: null })}
        onConfirm={handleRemove}
        title="Eliminar Categoría"
        confirmText="Sí, eliminar"
        confirmColor="red"
      >
        <p>
          ¿Estás seguro de que quieres eliminar la categoría{" "}
          <strong>"{modalState.data?.nombre}"</strong>? Esta acción no se puede deshacer.
        </p>
      </ConfirmationModal>

      <ConfirmationModal
        isOpen={modalState.type === "conflict"}
        onClose={() => setModalState({ type: null, data: null })}
        onConfirm={forceDelete}
        title="La categoría está en uso"
        confirmText="Eliminar de todos modos"
        confirmColor="red"
      >
        <p className="mb-3">
          <b>{modalState.data?.catName}</b> no se puede eliminar porque está asignada a platos o
          combos.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-gray-600">
          <li>
            Está en <b>{modalState.data?.inCombos}</b> grupo(s) de combos.
          </li>
          <li>
            La usan <b>{modalState.data?.inMenuItems}</b> plato(s) del menú.
          </li>
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Si continúas, los platos quedarán sin categoría y los grupos de combos afectados se
          eliminarán.
        </p>
      </ConfirmationModal>
    </>
  );
}
