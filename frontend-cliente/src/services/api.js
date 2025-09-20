// frontend-cliente/src/services/api.js
// ✅ Versión simplificada: SOLO usa el backend de pedidos (:4000)

export const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

/* ---------- Helpers de auth ---------- */
const authHeader = () => {
  const t = localStorage.getItem("client_token") || localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}`, "x-db-token": t } : {};
};

const idem = () =>
  crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;

const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};

/* ---------- CSRF helpers (:4000) ---------- */
let CSRF_TOKEN = null;

async function seedCsrf() {
  try {
    const res = await fetch(`${API_BASE}/api/csrf`, {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    try {
      const j = await res.clone().json();
      if (j?.csrf_token) CSRF_TOKEN = j.csrf_token;
    } catch {
      const fromCookie = getCookie("csrf_token");
      if (fromCookie) CSRF_TOKEN = fromCookie;
    }
  } catch {}
}

async function ensureCsrf() {
  if (!CSRF_TOKEN) {
    const fromCookie = getCookie("csrf_token");
    if (fromCookie) CSRF_TOKEN = fromCookie;
    else await seedCsrf();
  }
  return CSRF_TOKEN || getCookie("csrf_token") || null;
}

/* ---------- helpers genéricos :4000 ---------- */
async function get(path, params) {
  const url =
    `${API_BASE}${path}` +
    (params
      ? (path.includes("?") ? "&" : "?") + new URLSearchParams(params).toString()
      : "");
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`);
  try { return JSON.parse(text); } catch { return text; }
}

/* POST que devuelve status/data (para manejar 409) */
async function postRaw(path, body, withAuth = false, extraHeaders = null) {
  await ensureCsrf();
  const csrf = CSRF_TOKEN || getCookie("csrf_token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(withAuth ? authHeader() : {}),
    ...(csrf ? { "x-csrf-token": csrf } : {}),
    ...(extraHeaders || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, ok: res.ok, data };
}

async function patch(path, body = {}, withAuth = false, extraHeaders = null) {
  await ensureCsrf();
  const csrf = CSRF_TOKEN || getCookie("csrf_token");
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(withAuth ? authHeader() : {}),
    ...(csrf ? { "x-csrf-token": csrf } : {}),
    ...(extraHeaders || {}),
  };
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `${res.status} ${res.statusText}`);
  try { return JSON.parse(text); } catch { return text; }
}

/* ---------- config pública ---------- */
export async function apiGetPublicConfig(restaurantId) {
  const r = await get(`/api/public/restaurants/${Number(restaurantId)}`);
  return { name: r?.nombre || "", nombre: r?.nombre || "", billingMode: r?.billing_mode || "none" };
}

export async function apiResolveMesaId(restaurantId, mesaCode) {
  if (!Number(restaurantId) || !mesaCode) return null;
  const r = await get(`/api/public/mesas/resolve`, { restaurantId, mesaCode });
  return r?.id || r?.mesaId || null;
}

/* ---------- crear pedido SOLO en :4000 ---------- */
async function createPedido4000ConRetry(body, restaurantId) {
  // 1º intento
  let r = await postRaw(
    `/api/pedidos`,
    body,
    true,
    { "x-restaurant-id": String(restaurantId) }
  );
  if (r.ok) return r.data;

  // Si no es 409 → error
  if (r.status !== 409) {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data || {});
    throw new Error(err);
  }

  // 409 → abandonar y reintentar
  const pedidoId = r?.data?.pedidoId ?? r?.data?.id ?? r?.data?.pedido_id ?? null;
  if (!pedidoId) {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data || {});
    throw new Error(err);
  }

  try {
    await patch(`/api/pedidos/${pedidoId}/abandonar`, {}, true, { "x-restaurant-id": String(restaurantId) });
  } catch {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data || {});
    throw new Error(err);
  }

  // 2º intento
  r = await postRaw(
    `/api/pedidos`,
    body,
    true,
    { "x-restaurant-id": String(restaurantId) }
  );
  if (!r.ok) {
    const err = typeof r.data === "string" ? r.data : JSON.stringify(r.data || {});
    throw new Error(err);
  }
  return r.data;
}

export async function apiCreatePedido({
  restaurantId,
  mesaId,
  items,
  idempotencyKey,
  comprobanteTipo,
  billingClient,
  billingEmail,
  billingMode,   // se ignora la bifurcación a FACT_API (siempre :4000)
  amount,
  note,
}) {
  if (!Number(restaurantId) || !Number(mesaId) || !Array.isArray(items) || !items.length) {
    throw new Error("Parámetros inválidos");
  }

  const baseBody = {
    restaurantId,
    mesaId,
    items,
    idempotencyKey: idempotencyKey || idem(),
    comprobanteTipo,
    billingClient,
    billingEmail,
    amount,                           // en soles (si lo tienes calculado)
    note: (typeof note === "string" && note.trim().length > 0) ? note.trim() : null,
  };

  // Siempre usamos el backend de pedidos :4000 (con retry de 409)
  return await createPedido4000ConRetry(baseBody, restaurantId);
}
