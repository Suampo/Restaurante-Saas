// src/lib/api.js
export const API_BASE = import.meta.env.VITE_API_URL || "";

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${path} ${res.status}: ${text}`);
  }
  return res.json();
}

export function prepareCheckout(payload) {
  return post("/api/checkout/prepare", payload);
}
