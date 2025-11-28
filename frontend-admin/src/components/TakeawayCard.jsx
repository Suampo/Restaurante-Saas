// src/components/TakeawayCard.jsx
import { useEffect, useState } from "react";
import { ensureTakeaway, getTakeawayInfo, getTakeawayQR } from "../services/takeawayApi";

// Iconitos inline (sin dependencias)
const IconBag = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path
      fill="currentColor"
      d="M6 7V6a6 6 0 1 1 12 0v1h1a2 2 0 0 1 2 2l-1 11a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3L3 9a2 2 0 0 1 2-2h1zm2 0h8V6a4 4 0 0 0-8 0v1z"
    />
  </svg>
);
const IconExternal = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path
      fill="currentColor"
      d="M14 3h7v7h-2V6.41l-9.29 9.3-1.42-1.42 9.3-9.29H14V3z"
    />
    <path
      fill="currentColor"
      d="M5 5h6v2H7v10h10v-4h2v6H5z"
    />
  </svg>
);
const IconCopy = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path
      fill="currentColor"
      d="M16 1H4a2 2 0 0 0-2 2v12h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 14H8V7h11v12z"
    />
  </svg>
);
const IconDownload = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path
      fill="currentColor"
      d="M5 20h14v-2H5m7-14v8l3.5-3.5 1.42 1.42L12 18l-4.92-4.92L8.5 11.7 12 15V6h2z"
    />
  </svg>
);
const IconRefresh = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path
      fill="currentColor"
      d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a5 5 0 1 1-5 5H5a7 7 0 1 0 12.65-5.65z"
    />
  </svg>
);
const IconPrint = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}>
    <path
      fill="currentColor"
      d="M19 8H5a3 3 0 0 0-3 3v4h4v4h12v-4h4v-4a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zM18 3H6v4h12V3z"
    />
  </svg>
);

export default function TakeawayCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [png, setPng] = useState(null);
  const [link, setLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showFull, setShowFull] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      await ensureTakeaway();           // crea si no existe
      await getTakeawayInfo();          // asegura mesaId
      const qr = await getTakeawayQR(); // genera QR con ?takeaway=1
      setPng(qr.png);
      setLink(qr.url);
    } catch (e) {
      console.error(e);
      setError("No se pudo generar el QR de LLEVAR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const copyLink = async () => {
    try {
      if (!link) return;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const downloadPng = () => {
    if (!png) return;
    const a = document.createElement("a");
    a.href = png;
    a.download = "QR_LLEVAR.png";
    a.click();
  };

  const printQr = () => {
    if (!png) return;
    const w = window.open("", "_blank", "width=600,height=800");
    const html = `
      <html><head><title>QR LLEVAR</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px}
        .box{display:flex;flex-direction:column;align-items:center}
        img{width:320px;height:320px;object-fit:contain}
        p{font-size:12px;color:#555;word-break:break-all}
      </style></head>
      <body><div class="box">
        <h3>Pedidos para llevar</h3>
        <img src="${png}" />
        <p>${link || ""}</p>
      </div></body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="w-full max-w-[480px] md:max-w-none rounded-2xl border bg-white shadow-sm ring-1 ring-black/5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white">
            <IconBag />
          </div>
          <div>
            <div className="text-base font-semibold text-neutral-900">LLEVAR</div>
            <div className="text-[13px] text-neutral-600">
              Escanéalo para pedir sin mesa. Pedidos concurrentes.
            </div>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            Para llevar
          </span>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
            title="Refrescar QR"
          >
            <IconRefresh /> Refrescar
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid items-start gap-4 p-4 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        {/* QR + acciones */}
        <div className="flex flex-col items-center md:items-start">
          <div className="rounded-xl border bg-white p-2 shadow-sm">
            {loading ? (
              <div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-neutral-200" />
            ) : error ? (
              <div className="grid h-[220px] w-[220px] place-items-center text-sm text-rose-700">
                {error}
              </div>
            ) : (
              <img
                src={png}
                alt="QR LLEVAR"
                className="h-[220px] w-[220px] rounded-lg border object-contain"
              />
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <button
              type="button"
              onClick={downloadPng}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <IconDownload /> Descargar PNG
            </button>
            <button
              type="button"
              onClick={printQr}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
            >
              <IconPrint /> Imprimir
            </button>
          </div>
        </div>

        {/* Link + acciones */}
        <div className="w-full space-y-3">
          <div>
            <div className="text-xs font-medium text-neutral-500">Abrir link</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <a
                href={link || "#"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500"
              >
                <IconExternal /> Abrir
              </a>
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <IconCopy /> {copied ? "Copiado" : "Copiar enlace"}
              </button>
            </div>
          </div>

          {/* Ver link completo (responsivo) */}
          <div className="rounded-xl border bg-neutral-50/70 p-3 text-sm text-neutral-700">
            <button
              type="button"
              onClick={() => setShowFull((v) => !v)}
              className="flex w-full items-center justify-between text-left text-[13px] text-neutral-600"
            >
              <span>{showFull ? "Ocultar link" : "Ver link completo"}</span>
            </button>

            {showFull && (
              <div className="mt-2 max-h-32 w-full overflow-y-auto rounded-md border bg-white p-2 text-[13px] text-neutral-800 break-all">
                {link}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
