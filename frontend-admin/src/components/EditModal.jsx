// src/components/EditModal.jsx
import { useEffect, useState } from "react";
import { X } from "lucide-react";

export default function EditModal({
  isOpen,
  onClose,
  onSave,
  title,
  label,
  initialValue,
  inputType = "text",
  placeholder = "",
  // seguimos aceptando `position` para compatibilidad,
  // pero no lo usamos (centramos el modal).
  position,
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue ?? "");
      setSaving(false);
    }
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!onSave) {
      onClose?.();
      return;
    }
    try {
      setSaving(true);
      await onSave(value);
      // si todo sale bien, cerramos
      onClose?.();
    } catch (err) {
      console.error(err);
      // si hay error, el padre ya muestra alert, dejamos el modal abierto
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-6">
      <div className="w-full max-w-sm max-h-full overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 px-4 py-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">
              {label}
            </label>
            <input
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-400"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
