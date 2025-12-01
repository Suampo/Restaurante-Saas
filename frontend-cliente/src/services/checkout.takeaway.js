// src/services/checkout.takeaway.js

// Base del backend de pedidos (API pública)
const API_BASE = (
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

// ===== CSRF helpers (double-submit cookie) =====
let csrfTokenPedidos = null;

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(
    new RegExp("(^|;\\s*)" + name + "=([^;]+)")
  );
  return m ? decodeURIComponent(m[2]) : null;
}

function getCsrfFromCookies() {
  return (
    getCookie("csrf_token") ||
    getCookie("XSRF-TOKEN") ||
    getCookie("_csrf") ||
    null
  );
}

function withCsrf(headers = {}) {
  const token = csrfTokenPedidos || getCsrfFromCookies();
  return token
    ? { ...headers, "x-csrf-token": token }
    : headers;
}

// Pide /api/csrf al backend de pedidos y guarda el token retornado
export async function ensureCsrfCookiePedidos() {
  try {
    const res = await fetch(`${API_BASE}/api/csrf`, {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-store" },
    });

    if (!res.ok) {
      console.warn("ensureCsrfCookiePedidos: status", res.status);
      return;
    }

    // El backend debe devolver algo como: { csrfToken: "..." }
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const t =
      (data &&
        (data.csrfToken ||
          data.token ||
          data._csrf)) ||
      null;

    if (t && typeof t === "string") {
      csrfTokenPedidos = t;
    }

    // Fallback por si algún día solo lo expones en cookie legible
    if (!csrfTokenPedidos) {
      const fromCookie = getCsrfFromCookies();
      if (fromCookie) csrfTokenPedidos = fromCookie;
    }
  } catch (e) {
    console.error("checkout.takeaway ensureCsrfCookiePedidos:", e);
  }
}

const api = (p) =>
  `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

/**
 * Crea SIEMPRE un intent nuevo para LLEVAR.
 * IMPORTANTE: NO enviar mesaId, el backend lo guarda NULL por constraint.
 */
export async function crearIntentTakeaway({
  restaurantId,
  amount,
  cart = [],
  note = null,
}) {
  // Siempre refrescamos el token antes de hacer POST al backend de pedidos
  await ensureCsrfCookiePedidos();

  const res = await fetch(api("/api/takeaway/checkout-intents"), {
    method: "POST",
    credentials: "include",
    headers: withCsrf({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
    body: JSON.stringify({ restaurantId, amount, cart, note }), // sin mesaId
  });

  if (!res.ok) {
    let payload = null;
    let text = "";
    try {
      text = await res.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    } catch {
      // ignore
    }

    const msg =
      (payload && payload.error) ||
      text ||
      `HTTP ${res.status}`;

    const err = new Error(msg);
    err.response = { status: res.status, data: payload ?? text };
    throw err;
  }

  return res.json();
}
