// src/components/EditModal.jsx
import { useState, useEffect } from "react";

const IconClose = ({ className = "h-6 w-6" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function EditModal({
  isOpen,
  onClose,
  onSave,
  position, // <-- Aceptamos la nueva prop de posición
  title,
  label,
  initialValue = "",
  inputType = "text",
  placeholder = "",
}) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [initialValue, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => { onSave(value); onClose(); };
  const handleKeyDown = (e) => { if (e.key === 'Enter') handleSave(); };

  // Estilos para posicionar el popover. Si no hay posición, se centra como respaldo.
  const popoverStyles = position 
    ? { top: `${position.top}px`, left: `${position.left}px`, transform: 'translateX(-50%)' } // Centrado horizontalmente al botón
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    // Capa transparente para detectar clics afuera y cerrar
    <div className="fixed inset-0 z-40" onClick={onClose}>
      
      {/* Contenedor del Popover con posicionamiento absoluto */}
      <div
        style={popoverStyles}
        className="absolute z-50 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()} // Evita que se cierre al hacer clic adentro
      >
        <div className="flex items-start justify-between">
          <h3 className="text-base font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-100" aria-label="Cerrar">
            <IconClose className="h-5 w-5" />
          </button>
        </div>
        
        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-700">{label}</label>
          <input
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full rounded-lg border-gray-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
            placeholder={placeholder}
            autoFocus
            step={inputType === 'number' ? '0.01' : undefined}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-200">
            Cancelar
          </button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500">
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}