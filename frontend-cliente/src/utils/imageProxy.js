// frontend-cliente/src/utils/imageProxy.js

const PEDIDOS_API_BASE = (
  import.meta.env.VITE_API_PEDIDOS || "http://localhost:4000"
).replace(/\/$/, "");

export function proxyImg(url, width = 400, height = 0) {
  if (!url) return "";

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
