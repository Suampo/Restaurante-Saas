// src/components/legal/ConsentModal.jsx
import { useEffect, useRef, useState } from "react";

export default function ConsentModal({
  open,
  onClose,
  onConfirm,            // (payload) => void   payload = { required:true, marketing:boolean }
  defaultMarketing = false,
}) {
  const panelRef = useRef(null);
  const [requiredChecked, setRequiredChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(defaultMarketing);

  useEffect(() => {
    if (!open) return;
    setRequiredChecked(false);      // resetea cada vez que se abre
    setMarketingChecked(defaultMarketing);
  }, [open, defaultMarketing]);

  // Cerrar con ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Cerrar al hacer click fuera
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/10"
      >
        <h2 className="text-xl font-bold">Tratamiento de Datos — Consentimiento</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Al continuar, autorizas a <strong>Gerimi Angelo Oroncoy Cordova [ Mikhunappfood]</strong> a tratar tus datos
          personales conforme a nuestra{" "}
          <a className="underline" href="/legal/privacidad" target="_blank" rel="noreferrer">
            Política de Privacidad
          </a>{" "}
          y el{" "}
          <a className="underline" href="/legal/consentimiento" target="_blank" rel="noreferrer">
            detalle del consentimiento
          </a>.
        </p>

        <div className="mt-5 space-y-3 text-sm text-neutral-800">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              checked={requiredChecked}
              onChange={(e) => setRequiredChecked(e.target.checked)}
            />
            <span>
              Acepto el <strong>tratamiento necesario</strong> para operar el servicio:
              creación de cuenta, registro de pedidos, seguridad y comunicaciones
              operativas.
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              checked={marketingChecked}
              onChange={(e) => setMarketingChecked(e.target.checked)}
            />
            <span>
              Deseo recibir <strong>ofertas y novedades</strong> (puedo revocar cuando
              quiera).
            </span>
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm hover:bg-neutral-50"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!requiredChecked}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => onConfirm?.({ required: true, marketing: marketingChecked })}
          >
            Acepto
          </button>
        </div>
      </div>
    </div>
  );
}
