// src/services/checkout.takeaway.js

const API_BASE = (
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000"
).replace(/\/+$/, "");

// ===== CSRF helpers (double-submit cookie) =====
let csrfTokenPedidos = null;

function withCsrf(headers = {}) {
  if (!csrfTokenPedidos) return headers;
  return { ...headers, "x-csrf-token": csrfTokenPedidos };
}

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
    } else {
      console.warn("ensureCsrfCookiePedidos: respuesta sin token usable", data);
    }
  } catch (e) {
    console.error("checkout.takeaway ensureCsrfCookiePedidos:", e);
  }
}

const api = (p) =>
  `${API_BASE}${p.startsWith("/") ? p : `/${p}`}`;

export async function crearIntentTakeaway({
  restaurantId,
  amount,
  cart = [],
  note = null,
}) {
  await ensureCsrfCookiePedidos();

  const res = await fetch(api("/api/takeaway/checkout-intents"), {
    method: "POST",
    credentials: "include",
    headers: withCsrf({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
    body: JSON.stringify({ restaurantId, amount, cart, note }),
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
