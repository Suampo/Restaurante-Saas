// src/services/mpCheckoutPro.js
function getBase() {
  // acepta ambas envs para evitar confusiones
  return (import.meta.env.VITE_PSP_API_URL || import.meta.env.VITE_PASARELA_URL || "http://localhost:5500")
    .replace(/\/+$/, "");
}

export async function createMpPreference({ title, unit_price, buyerEmail, metadata, idempotencyKey }) {
  const rid = Number(metadata?.restaurantId || 0);
  const url = `${getBase()}/psp/mp/preferences${rid ? `?restaurantId=${rid}` : ""}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey || String(Date.now())
    },
    body: JSON.stringify({
      title,
      unit_price: Number(unit_price),
      currency_id: "PEN",
      quantity: 1,
      buyerEmail,
      metadata
    }),
    credentials: "include",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json(); // { preferenceId, initPoint }
}

export function goToCheckoutPro(initPoint) {
  window.location.href = initPoint;
}
