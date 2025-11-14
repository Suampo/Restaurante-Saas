// src/services/mercadopago.js
import axios from "axios";

/* ======= CSRF helpers (si tu backend los usa) ======= */
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

/* ======= Base de PASARELA (:5500/api o override por env) ======= */
function apiPsp(path) {
  const base =
    import.meta.env.VITE_PASARELA_URL ||
    import.meta.env.VITE_PSP_API_URL ||
    "http://localhost:5500/api";
  return base.replace(/\/+$/, "") + path;
}

/* ======= Singleton de MP.js v2 para Device Session ======= */
function getMpSingleton() {
  try {
    const pk = window.__MP_INIT_KEY || import.meta.env.VITE_MP_PUBLIC_KEY;
    if (!window.MercadoPago || !pk) return null;
    return (window.__MP_SINGLETON =
      window.__MP_SINGLETON || new window.MercadoPago(pk, { locale: "es-PE" }));
  } catch {
    return null;
  }
}
function getMpDeviceId() {
  const mp = getMpSingleton();
  return mp && typeof mp.getDeviceId === "function" ? mp.getDeviceId() : null;
}

/* ======= Public Key (para @mercadopago/sdk-react) ======= */
export async function getMPPublicKey(restaurantId) {
  const url =
    apiPsp("/psp/mp/public-key") +
    (restaurantId ? `?restaurantId=${Number(restaurantId)}` : "");
  const { data } = await axios.get(url);
  if (!data?.publicKey) throw new Error("Public key no configurada");
  return data.publicKey;
}

/* ======= Pago con Tarjeta (CardPayment Brick) ======= */
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
  const deviceId = getMpDeviceId();

  const url =
    apiPsp("/psp/mp/payments/card") + (rid ? `?restaurantId=${rid}` : "");

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: withCsrf({
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
      ...(deviceId ? { "X-Device-Session-Id": deviceId } : {}),
    }),
    body: JSON.stringify({
      amount: Number(amount),
      formData,
      description,
      metadata, // { restaurantId, intentId, pedidoId, ... }
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ======= Pago con Yape (token MP.js v2) ======= */
export async function payWithYape({
  token,
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
  const deviceId = getMpDeviceId();

  const url =
    apiPsp("/psp/mp/payments/yape") + (rid ? `?restaurantId=${rid}` : "");

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: withCsrf({
      "Content-Type": "application/json",
      "X-Idempotency-Key": idem,
      ...(deviceId ? { "X-Device-Session-Id": deviceId } : {}),
    }),
    body: JSON.stringify({
      token,
      amount: Number(amount),
      email,
      description,
      metadata,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `HTTP ${res.status}`);
  }
  return res.json();
}
