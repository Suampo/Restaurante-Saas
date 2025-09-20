import { useState } from "react";
import { QrCode, Trash2, Download, Copy } from "lucide-react";

export default function MesaCard({ mesa, qr, onGenerate, onDelete, onCopy }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleToggleQR = async () => {
    if (open) { setOpen(false); return; }
    if (!qr && typeof onGenerate === "function") {
      try {
        setBusy(true);
        await onGenerate(mesa.id);
      } finally {
        setBusy(false);
      }
    }
    setOpen(true);
  };

  return (
    <div className="self-start rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{mesa.codigo}</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {mesa.descripcion || "Sin descripción"}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleToggleQR}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-green-800 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-60"
            title={qr ? "Ver QR" : "Generar QR"}
          >
            <QrCode size={16} />
            {open ? "Ocultar QR" : busy ? "Generando..." : (qr ? "Ver QR" : "Generar QR")}
          </button>

          <button
            onClick={() => onDelete(mesa.id)}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
            title="Eliminar mesa"
          >
            <Trash2 size={16} />
            Eliminar
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-slate-800">QR de {mesa.codigo}</span>
            <div className="flex items-center gap-2">
              <a
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs transition hover:bg-slate-50 disabled:opacity-50"
                href={qr || "#"}
                download={`mesa_${mesa.codigo}.png`}
                onClick={(e) => { if (!qr) e.preventDefault(); }}
              >
                <Download size={14} />
                Descargar
              </a>
              <button
                onClick={() => onCopy(mesa.id)}
                disabled={!qr}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs transition hover:bg-slate-50 disabled:opacity-50"
              >
                <Copy size={14} />
                Copiar link
              </button>
            </div>
          </div>

          <div className="mt-3 flex justify-center">
            {qr ? (
              <img
                src={qr}
                alt={`QR de ${mesa.codigo}`}
                className="h-auto w-40 rounded-md border border-slate-200"
                loading="lazy"
              />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-md border border-dashed border-slate-300 text-xs text-slate-500">
                Genera el QR para mostrarlo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
