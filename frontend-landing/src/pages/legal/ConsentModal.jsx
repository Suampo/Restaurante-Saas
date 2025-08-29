// src/components/legal/ConsentModal.jsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom"; // 👈 NUEVO

export default function ConsentModal({
  open,
  onClose,
  onConfirm,
  defaultMarketing = false,
}) {
  const panelRef = useRef(null);
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(defaultMarketing);

  useEffect(() => {
    if (!open) return;
    setRequiredChecked(false);
    setMarketingChecked(defaultMarketing);
  }, [open, defaultMarketing]);

  // ESC para cerrar
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // 🔒 Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  // ⛳ Renderiza en <body> para evitar clipping por overflow/transform de ancestros
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 h-[100dvh]"
      role="dialog"
      aria-modal="true"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.(); // cerrar al tocar fuera
      }}
    >
      <div
        ref={panelRef}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10 pb-[env(safe-area-inset-bottom)]"
      >
        <h2 className="text-xl font-bold">Tratamiento de Datos — Consentimiento</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Al continuar, autorizas a <strong>Gerimi Angelo Oroncoy Cordova [Mikhunappfood]</strong> a tratar tus datos
          personales conforme a nuestra{" "}
          <a className="underline" href="/legal/privacidad" target="_blank" rel="noreferrer">Política de Privacidad</a>{" "}
          y el{" "}
          <a className="underline" href="/legal/consentimiento" target="_blank" rel="noreferrer">detalle del consentimiento</a>.
        </p>

        <div className="mt-5 space-y-3 text-sm text-neutral-800">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              checked={requiredChecked}
              onChange={(e) => setRequiredChecked(e.target.checked)}
            />
            <span> Acepto el <strong>tratamiento necesario</strong>… </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              checked={marketingChecked}
              onChange={(e) => setMarketingChecked(e.target.checked)}
            />
            <span> Deseo recibir <strong>ofertas y novedades</strong>… </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!requiredChecked}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-70"
            onClick={() => onConfirm?.({ required: true, marketing: marketingChecked })}
          >
            Acepto
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
