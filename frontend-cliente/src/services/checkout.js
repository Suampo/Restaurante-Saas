// src/services/checkout.js
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

/* ===== CSRF helpers ===== */
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function withCsrf(headers = {}) {
  const csrf =
    getCookie("csrf_token") ||
    getCookie("XSRF-TOKEN") ||
    getCookie("_csrf") ||
    null;
  return csrf ? { ...headers, "X-CSRF-Token": csrf } : headers;
}
async function ensureCsrfCookie() {
  if (getCookie("csrf_token")) return;
  try {
    await fetch(`${API_BASE}/api/csrf`, { credentials: "include" });
  } catch {}
}

/* ===== API helper ===== */
function api(path) {
  return `${API_BASE.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/* ===== Intents ===== */
export async function crearOActualizarIntent({ restaurantId, mesaId, amount, cart = [], note = null }) {
  await ensureCsrfCookie();
  const res = await fetch(api("/api/checkout/intents"), {
    method: "POST",
    credentials: "include",
    headers: withCsrf({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
    body: JSON.stringify({ restaurantId, mesaId, amount, cart, note }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // { id, status:'pending', external_reference, ... }
}

export async function abandonarIntent(id) {
  if (!id) return;
  await ensureCsrfCookie();
  try {
    await fetch(api(`/api/checkout/intents/${id}/abandon`), {
      method: "POST",
      credentials: "include",
      headers: withCsrf({ "Content-Type": "application/json" }),
    });
  } catch {}
}
