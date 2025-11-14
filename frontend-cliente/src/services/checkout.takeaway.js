// src/services/checkout.takeaway.js
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

async function ensureCsrfCookie() {
  try {
    await fetch(`${API_BASE}/api/csrf`, { credentials: "include" });
  } catch {}
}

const api = (p) =>
  `${API_BASE.replace(/\/+$/, "")}${p.startsWith("/") ? p : `/${p}`}`;

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
  await ensureCsrfCookie();
  const res = await fetch(api("/api/takeaway/checkout-intents"), {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify({ restaurantId, amount, cart, note }), // sin mesaId
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
