// src/services/mercadopago.js
import axios from "axios";

/* ======= Base de PASARELA (MP) ======= */
/**
 * Devuelve la URL base de la pasarela.
 * Prioriza SIEMPRE VITE_PSP_API_URL (ya apunta a /api en tu .env).
 */
function apiPsp(path) {
  const base =
    import.meta.env.VITE_PSP_API_URL || // <--- PRIORIDAD
    import.meta.env.VITE_PASARELA_URL ||
    import.meta.env.VITE_API_PASARELA ||
    "http://localhost:5500/api";

  return base.replace(/\/+$/, "") + path;
}

/* ======= CSRF helpers ======= */
let csrfTokenPsp = null;

function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

function getCsrfFromCookiesPsp() {
  return (
    getCookie("csrf_token") ||
    getCookie("XSRF-TOKEN") ||
    getCookie("_csrf") ||
    null
  );
}

function withCsrf(headers = {}) {
  const token = csrfTokenPsp || getCsrfFromCookiesPsp();
  return token
    ? { ...headers, "x-csrf-token": token }
    : headers;
}

/**
 * Inicializa la cookie/token CSRF para la PASARELA.
 */
export async function ensureCsrfCookie() {
  try {
    const res = await fetch(apiPsp("/csrf"), {
      method: "GET",
      credentials: "include",
      headers: { "Cache-Control": "no-store" },
    });

    if (!res.ok) {
      console.warn("ensureCsrfCookie (psp): status", res.status);
      return;
    }

    try {
      const data = await res.json().catch(() => null);
      const t =
        (data &&
          (data.csrfToken ||
            data.token ||
            data._csrf)) ||
        null;
      if (t && typeof t === "string") {
        csrfTokenPsp = t;
      }
    } catch (e) {
      console.warn("ensureCsrfCookie (psp) parse json:", e);
    }

    if (!csrfTokenPsp) {
      const fromCookie = getCsrfFromCookiesPsp();
      if (fromCookie) csrfTokenPsp = fromCookie;
    }
  } catch (e) {
    console.error("ensureCsrfCookie PSP:", e);
  }
}

/* ======= Singleton de MP.js v2 para Device Session ======= */
function getMpSingleton() {
  try {
    const pk = window.__MP_INIT_KEY || import.meta.env.VITE_MP_PUBLIC_KEY;
    if (!window.MercadoPago || !pk) return null;
    return (window.__MP_SINGLETON =
      window.__MP_SINGLETON ||
      new window.MercadoPago(pk, { locale: "es-PE" }));
  } catch {
    return null;
  }
}

function getMpDeviceId() {
  const mp = getMpSingleton();
  return mp && typeof mp.getDeviceId === "function"
    ? mp.getDeviceId()
    : null;
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
  // Nos aseguramos de tener cookie/token CSRF para la pasarela
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
