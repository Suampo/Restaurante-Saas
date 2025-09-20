// src/components/ExportDialog.jsx
import { useMemo, useState } from "react";
import API from "../services/axiosInstance";

// 🔗 claves EXACTAS según tu backend (routes/export.js)
const RESOURCES = [
  { key: "pedidos",               label: "Pedidos" },
  { key: "pedidos_items",         label: "Detalle de pedidos" },
  { key: "pedidos_componentes",   label: "Componentes de combos" },
  { key: "pagos",                 label: "Pagos" },
  { key: "cpe",                   label: "Comprobantes electrónicos (CPE)" },
  { key: "menu_items",            label: "Productos" },
  { key: "categorias",            label: "Categorías" },
  { key: "combos",                label: "Combos" },
  { key: "insumos",               label: "Insumos" },
  { key: "inv_movimientos",       label: "Movimientos de inventario" },
  { key: "recetas",               label: "Recetas" },
  { key: "mesas",                 label: "Mesas" },
];

const parseFilename = (disposition, fallback) => {
  if (!disposition) return fallback;
  const m = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  try { return decodeURIComponent((m?.[1] || "").replace(/"/g, "")) || fallback; }
  catch { return fallback; }
};

export default function ExportDialog({ open, onClose, from, to }) {
  const [selected, setSelected] = useState(() => new Set(["pedidos", "pagos"]));
  const [downloading, setDownloading] = useState({});
  const [busyAll, setBusyAll] = useState(false);

  // 👇 base del backend (p.ej. http://localhost:4000/api)
  const API_BASE = (API?.defaults?.baseURL || "").replace(/\/$/, "");

  // 👇 construye la URL real contra el BACKEND (/api/export/...)
  const buildUrl = (key) =>
    `${API_BASE}/export/${encodeURIComponent(key)}.csv?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;

  const rangeText = useMemo(() => {
    const fmt = (iso) =>
      new Date(iso + "T00:00:00").toLocaleDateString("es-PE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
    return `${fmt(from)} a ${fmt(to)}`;
  }, [from, to]);

  if (!open) return null;

  const toggle = (k) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const saveBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // descarga 1 recurso como blob CSV usando axios (mantiene headers/tokens/cookies)
  const downloadOne = async (key) => {
    setDownloading((s) => ({ ...s, [key]: true }));
    try {
      const res = await API.get(`/export/${key}.csv`, {
        params: { from, to },
        responseType: "blob",
        withCredentials: true, // por si tu auth usa cookies
      });
      const cd = res.headers?.["content-disposition"];
      const fallback = `${key}_${from}_${to}.csv`;
      const filename = parseFilename(cd, fallback);
      saveBlob(res.data, filename);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "No se pudo descargar";
      alert(`Error descargando ${key}: ${msg}`);
      console.error("Export error", key, err);
    } finally {
      setDownloading((s) => ({ ...s, [key]: false }));
    }
  };

  const downloadSelected = async () => {
    const items = Array.from(selected);
    if (items.length === 0) {
      alert("Selecciona al menos un recurso.");
      return;
    }
    setBusyAll(true);
    try {
      for (const k of items) {
        // eslint-disable-next-line no-await-in-loop
        await downloadOne(k);
      }
    } finally {
      setBusyAll(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* header */}
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h2 className="text-base font-semibold">Exportar datos</h2>
            <p className="text-xs text-neutral-600">
              Rango: <b>{rangeText}</b>. Se descargará en formato CSV.
            </p>
          </div>
          <button className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600" onClick={onClose}>✕</button>
        </div>

        {/* body */}
        <div className="max-h-[70vh] overflow-auto p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {RESOURCES.map((r) => (
              <div key={r.key} className="flex items-center justify-between rounded-xl border p-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={selected.has(r.key)} onChange={() => toggle(r.key)} />
                  <span className="text-sm">{r.label}</span>
                </label>

                <div className="flex items-center gap-2">
                  {/* 🔗 Link directo por si quieres abrir en otra pestaña */}
                  <a
                    href={buildUrl(r.key)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50"
                    title={`Abrir ${r.label} en nueva pestaña`}
                  >
                    Abrir
                  </a>
                  <button
                    type="button"
                    className="rounded-lg border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60"
                    onClick={() => downloadOne(r.key)}
                    disabled={!!downloading[r.key] || busyAll}
                    title={`Descargar ${r.label}`}
                  >
                    {downloading[r.key] ? "Descargando…" : "Descargar"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t bg-white/95 px-5 py-3">
          <button
            type="button"
            className="rounded-lg border px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={onClose}
            disabled={busyAll}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={downloadSelected}
            disabled={busyAll || selected.size === 0}
          >
            {busyAll ? "Descargando…" : "Descargar seleccionados"}
          </button>
        </div>
      </div>
    </div>
  );
}
