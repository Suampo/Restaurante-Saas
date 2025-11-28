// src/utils/imageProxy.js

// Debes tener VITE_PEDIDOS_API_URL en tus variables de entorno de Vite/Cloudflare Pages
// Ejemplo en producción: https://api-pedidos.mikhunappfood.com
const PEDIDOS_API_BASE = (
  import.meta.env.VITE_PEDIDOS_API_URL || "http://localhost:4000"
).replace(/\/$/, "");

/**
 * Devuelve una URL proxificada por /img del backend-pedidos,
 * redimensionada y convertida a formato óptimo (webp/avif/jpeg).
 *
 * @param {string} url    URL original de Supabase (cover_url / imagen_url)
 * @param {number} width  ancho deseado en px (default 400)
 * @param {number} height alto deseado en px (opcional; 0 => auto)
 */
export function proxyImg(url, width = 400, height = 0) {
  if (!url) return "";

  // Si ya viene proxificada o no es http(s), la devolvemos tal cual
  if (!/^https?:\/\//i.test(url) || url.includes("/img?")) {
    return url;
  }

  const params = new URLSearchParams({
    url,
    width: String(width),
    q: "70",
    fit: "cover",
  });

  if (height) {
    params.set("height", String(height));
  }

  return `${PEDIDOS_API_BASE}/img?${params.toString()}`;
}
