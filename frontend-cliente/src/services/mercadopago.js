// src/services/mercadopago.js
import axios from "axios";

/* ========== CSRF helpers (si tu backend los usa) ========== */
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
  return csrf ? { ...headers, "x-csrf-token": csrf } : headers;
}
export async function ensureCsrfCookie() {
  try {
    const base = import.meta.env.VITE_API_URL || "http://localhost:4000";
    await fetch(base.replace(/\/+$/, "") + "/api/csrf", { credentials: "include" });
  } catch {}
}

/* ========== Base PASARELA (tu :5500/api) ========== */
function apiPsp(path) {
  const base =
    import.meta.env.VITE_PASARELA_URL ||
    import.meta.env.VITE_PSP_API_URL ||
    "http://localhost:5500/api";
  return base.replace(/\/+$/, "") + path;
}

/* ========== Public Key (para @mercadopago/sdk-react) ========== */
export async function getMPPublicKey(restaurantId) {
  const url =
    apiPsp("/psp/mp/public-key") +
    (restaurantId ? `?restaurantId=${Number(restaurantId)}` : "");
  const { data } = await axios.get(url);
  if (!data?.publicKey) throw new Error("Public key no configurada");
  return data.publicKey;
}

/* ========== Pago con Tarjeta (CardPayment Brick) ========== */
export async function payWithCardViaBrick({
  amount,
  formData,
  description,
  metadata = {},
  idempotencyKey,
}) {
  await ensureCsrfCookie();

  const rid = Number(metadata?.restaurantId || 0);
  const idem =
    idempotencyKey ||
    String(metadata?.intentId || metadata?.pedidoId || Date.now());

  const url =
    apiPsp("/psp/mp/payments/card") + (rid ? `?restaurantId=${rid}` : "");

  const res = await fetch(url, {
    method: "POST",
    headers: withCsrf({
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    }),
    body: JSON.stringify({
      amount: Number(amount),
      formData,
      description,
      metadata, // { restaurantId, intentId, pedidoId }
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ========== Pago con Yape (Payment Brick → token) ========== */
export async function payWithYape({
  token,             // ← viene del Payment Brick (formData.token)
  amount,
  email,
  description,
  metadata = {},
  idempotencyKey,
}) {
  await ensureCsrfCookie();

  const rid = Number(metadata?.restaurantId || 0);
  const idem =
    idempotencyKey ||
    String(metadata?.intentId || metadata?.pedidoId || Date.now());

  const url =
    apiPsp("/psp/mp/payments/yape") + (rid ? `?restaurantId=${rid}` : "");

  const res = await fetch(url, {
    method: "POST",
    headers: withCsrf({
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
    }),
    body: JSON.stringify({
      token,
      amount: Number(amount),
      email,
      description,
      metadata, // { restaurantId, intentId, pedidoId }
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}
