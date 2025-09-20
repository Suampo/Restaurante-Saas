export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#6b7280">Sin imagen</text></svg>`
  );

export function absolute(apiBase, url) {
  return url?.startsWith?.("http") ? url : url ? `${apiBase}${url}` : "";
}

const PEN = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 });
export function formatPEN(v) {
  try { return PEN.format(Number(v || 0)); }
  catch { return `S/ ${Number(v || 0).toFixed(2)}`; }
}
