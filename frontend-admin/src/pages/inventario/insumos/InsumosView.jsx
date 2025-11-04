    import { useEffect, useMemo, useState } from "react";
    import { inv } from "../../../services/inventarioApi";
    import Card from "../ui/Card";
    import { toast } from "../utils";

/* ---------- INSUMOS (REDISEÑADO) ---------- */
/* ---------- INSUMOS (REDISEÑO ELEGANTE Y SUAVE) ---------- */
export default function InsumosView() {
  const [rows, setRows] = useState([]);
  const [unis, setUnis] = useState([]);
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState({});
  const [form, setForm] = useState({
    nombre: "",
    unidad_id: "",
    stock_min: "",
    costo_unit: "",
  });

  // --- Lógica de datos (sin cambios) ---
  useEffect(() => {
    (async () => {
      const [ins, u] = await Promise.all([inv.insumos(), inv.unidades()]);
      setRows(ins || []);
      setUnis(u || []);
    })();
  }, []);

  const dedupUnis = [
    ...new Map(
      (unis || []).map((u) => [
        `${(u.abrev || "").toLowerCase()}|${(u.nombre || "").toLowerCase()}`,
        u,
      ])
    ).values(),
  ];

  const errs = {
    nombre:
      !form.nombre.trim()
        ? "Ingresa un nombre."
        : form.nombre.trim().length < 2
        ? "Demasiado corto."
        : "",
    unidad_id: !form.unidad_id ? "Selecciona una unidad." : "",
    stock_min:
      form.stock_min === "" ||
      Number.isNaN(Number(form.stock_min)) ||
      Number(form.stock_min) < 0
        ? "Mínimo ≥ 0."
        : "",
    costo_unit:
      form.costo_unit !== "" &&
      (Number.isNaN(Number(form.costo_unit)) || Number(form.costo_unit) < 0)
        ? "Costo ≥ 0 (o vacío)."
        : "",
  };
  const hasErr = Object.values(errs).some(Boolean);

  const onBlur = (k) => setTouched((s) => ({ ...s, [k]: true }));
  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    setTouched({ nombre: true, unidad_id: true, stock_min: true, costo_unit: true });
    if (hasErr || saving) return;

    try {
      setSaving(true);
      await inv.crear(form);
      setForm({ nombre: "", unidad_id: "", stock_min: "", costo_unit: "" });
      setTouched({}); // Limpiar errores
      const ins = await inv.insumos();
      setRows(ins || []);
      toast("Insumo creado con éxito");
    } catch (e2) {
      alert(e2?.response?.data?.error || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? rows.filter((r) => (r.nombre || "").toLowerCase().includes(t)) : rows;
  }, [rows, q]);

  // Helper para renderizar campos del formulario de forma consistente
  const Field = ({ name, label, error, children }) => (
    <div>
      <label htmlFor={`ins-${name}`} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
      {/* --- Formulario de Creación (Columna Izquierda) --- */}
      <div className="lg:col-span-1">
        <div className="sticky top-6">
          <Card>
            <form onSubmit={save} className="space-y-5" noValidate>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Crear Nuevo Insumo</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Añade un nuevo ítem a tu inventario.
                </p>
              </div>

              <Field
                name="nombre"
                label="Nombre del Insumo"
                error={touched.nombre && errs.nombre}
              >
                <input
                  id="ins-nombre"
                  placeholder="Ej: Tomate fresco"
                  value={form.nombre}
                  onChange={(e) => set("nombre", e.target.value)}
                  onBlur={() => onBlur("nombre")}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  name="unidad"
                  label="Unidad"
                  error={touched.unidad_id && errs.unidad_id}
                >
                  <select
                    id="ins-unidad"
                    value={form.unidad_id || ""}
                    onChange={(e) => set("unidad_id", e.target.value)}
                    onBlur={() => onBlur("unidad_id")}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Seleccionar</option>
                    {dedupUnis.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nombre} ({u.abrev})
                      </option>
                    ))}
                  </select>
                </Field>

                <Field
                  name="min"
                  label="Stock Mínimo"
                  error={touched.stock_min && errs.stock_min}
                >
                  <input
                    id="ins-min"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Ej: 5"
                    value={form.stock_min}
                    onChange={(e) => set("stock_min", e.target.value)}
                    onBlur={() => onBlur("stock_min")}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </Field>
              </div>

              <Field
                name="costo"
                label="Costo Unitario (Opcional)"
                error={touched.costo_unit && errs.costo_unit}
              >
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <span className="text-gray-500 sm:text-sm">S/</span>
                  </div>
                  <input
                    id="ins-costo"
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={form.costo_unit}
                    onChange={(e) => set("costo_unit", e.target.value)}
                    onBlur={() => onBlur("costo_unit")}
                    className="w-full rounded-lg border-gray-300 shadow-sm pl-7 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </Field>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-60"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                <span>{saving ? "Guardando..." : "Guardar Insumo"}</span>
              </button>
            </form>
          </Card>
        </div>
      </div>

      {/* --- Tabla de Insumos (Columna Derecha) --- */}
      <div className="lg:col-span-2">
        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Lista de Insumos</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Busca y visualiza todos los insumos de tu inventario.
                </p>
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4 text-gray-400"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    />
                  </svg>
                </div>
                <input
                  className="w-full rounded-lg border-gray-300 py-2 pl-9 pr-3 text-sm shadow-sm sm:w-64 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Buscar por nombre..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>

            <div className="-mx-6 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-gray-200">
                  <tr className="text-left">
                    <th scope="col" className="px-6 py-3 font-medium text-gray-500">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 font-medium text-gray-500">
                      Unidad
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right font-medium text-gray-500"
                    >
                      Stock Mínimo
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-right font-medium text-gray-500"
                    >
                      Costo Unitario
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-semibold text-gray-800">{r.nombre}</td>
                      <td className="px-6 py-4 text-gray-500">{r.unidad}</td>
                      <td className="px-6 py-4 text-right font-mono text-gray-500">
                        {Number(r.stock_min ?? 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-gray-500">
                        S/ {Number(r.costo_unit ?? 0).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-gray-500">
                        No se encontraron insumos.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}