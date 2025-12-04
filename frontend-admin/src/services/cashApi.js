// src/services/cashApi.js
import axios from "axios";

// ---- BASES ----
// Prioridad:
// 1) VITE_FACT_API_URL (ideal)
// 2) En dev, localhost:5000
// 3) En prod, dominio fijo api-facturacion.mikhunappfood.com
const FACT_BASE = import.meta.env.VITE_FACT_API_URL
  ? import.meta.env.VITE_FACT_API_URL.replace(/\/$/, "")
  : (import.meta.env.DEV
      ? "http://localhost:5000"
      : "https://api-facturacion.mikhunappfood.com"
    );

const SPLIT_BASE = "/api/split";   // rutas de split
const ADMIN_BASE = "/api/admin";   // rutas admin

export const FACT_API = axios.create({
  baseURL: FACT_BASE,
  withCredentials: true,   // cookies CSRF/sesión
  timeout: 20000,
});

let gotCsrf = false;

// ---- utils ----
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

// Identidad opcional (solo para UI + headers)
export function setAuthIdentity({ email, id, role, restaurantId } = {}) {
  if (email) {
    localStorage.setItem("user_email", email);
  } else {
    localStorage.removeItem("user_email");
  }

  if (id) {
    localStorage.setItem("user_id", id);
  } else {
    localStorage.removeItem("user_id");
  }

  if (role) {
    localStorage.setItem("user_role", role);
  } else {
    localStorage.removeItem("user_role");
  }

  if (restaurantId != null) {
    localStorage.setItem("restaurant_id", String(restaurantId));
  } else {
    localStorage.removeItem("restaurant_id");
  }
}

export function clearAuthIdentity() {
  setAuthIdentity({});
}

/**
 * Interceptor de request:
 * - Añade Authorization si existe token (incluye dbToken).
 * - Añade x-restaurant-id desde local/session.
 * - Añade x-app-user / x-app-user-id desde local/session.
 * - Resuelve CSRF para /api/split y /api/checkout.
 */
FACT_API.interceptors.request.use(async (config) => {
  const headers = config.headers || (config.headers = {});

  // === JWT: mozo/admin/dbToken ===
  const bearer =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token") ||
    localStorage.getItem("dbToken") ||
    sessionStorage.getItem("dbToken");

  if (bearer && !headers.Authorization) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  // === x-restaurant-id (clave para auth de /api/split) ===
  const rid =
    headers["x-restaurant-id"] ||
    localStorage.getItem("restaurant_id") ||
    sessionStorage.getItem("restaurant_id");

  if (rid) {
    headers["x-restaurant-id"] = String(rid);
  }

  // === Identidad del usuario (mozo/admin) para firmar pagos ===
  const email =
    headers["x-app-user"] ||
    localStorage.getItem("user_email") ||
    sessionStorage.getItem("user_email");

  const uid =
    headers["x-app-user-id"] ||
    localStorage.getItem("user_id") ||
    sessionStorage.getItem("user_id");

  if (email) headers["x-app-user"] = email;
  if (uid)   headers["x-app-user-id"] = uid;

  // === CSRF solo para split/checkout ===
  const url = typeof config.url === "string" ? config.url : "";
  const needsCsrf =
    url.startsWith(SPLIT_BASE) || url.startsWith("/api/checkout");

  if (needsCsrf) {
    let token = getCookie("csrf_token");
    if (!token && !gotCsrf) {
      await axios.get(`${FACT_BASE}/api/csrf`, { withCredentials: true });
      token = getCookie("csrf_token");
      gotCsrf = true;
    }
    if (token) headers["x-csrf-token"] = token;
  }

  return config;
});

/**
 * Interceptor de response:
 * - Si el backend devuelve 403 por CSRF inválido, reintenta tras pedir /api/csrf.
 */
FACT_API.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error?.config || {};
    const status = error?.response?.status;
    const msg = error?.response?.data?.error || "";

    // Solo consideramos reintento si el backend dice algo de CSRF
    const isCsrf =
      status === 403 &&
      !cfg.__retriedCsrf &&
      typeof msg === "string" &&
      msg.toLowerCase().includes("csrf");

    if (isCsrf) {
      try {
        await axios.get(`${FACT_BASE}/api/csrf`, { withCredentials: true });
        cfg.__retriedCsrf = true;
        return FACT_API(cfg);
      } catch {
        // si falla, seguimos con el error original
      }
    }

    throw error;
  }
);

// ----------------- API: SPLIT/EFECTIVO -----------------
export async function getSaldo(pedidoId) {
  const { data } = await FACT_API.get(
    `${SPLIT_BASE}/pedidos/${pedidoId}/saldo`
  );
  return data;
}

export async function crearPagoEfectivo(
  pedidoId,
  { amount, received, note }
) {
  const { data } = await FACT_API.post(
    `${SPLIT_BASE}/pedidos/${pedidoId}/pagos/efectivo`,
    { amount, received, note }
  );
  return data;
}

export async function aprobarPagoEfectivo(
  pedidoId,
  pagoId,
  { pin, received, note }
) {
  const { data } = await FACT_API.post(
    `${SPLIT_BASE}/pedidos/${pedidoId}/pagos/${pagoId}/aprobar`,
    { pin, received, note }
  );
  return data;
}

// ----------------- API: ADMIN -----------------
const mapEstado = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (["", "*", "todos", "todo", "all"].includes(s)) return undefined;
  if (["aprobado", "aprobados", "approved"].includes(s)) return "approved";
  if (["pendiente", "pendientes", "pending"].includes(s)) return "pending";
  return undefined;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listarMovimientosEfectivo({
  start,
  end,
  estado,
  userId,
} = {}) {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;

  const est = mapEstado(estado);
  if (est) params.estado = est;

  if (userId && UUID_RE.test(userId)) params.userId = userId;

  const { data } = await FACT_API.get(`${ADMIN_BASE}/cash-movements`, {
    params,
  });
  return data;
}

// ----------------- AUTH MOZO :5000 (opcional) -----------------
export async function loginMozo({ restaurantId, pin }) {
  const { data } = await FACT_API.post(
    "/api/auth/login-mozo",
    { restaurantId, pin },
    { withCredentials: true }
  );
  if (!data?.ok || !data?.token) throw new Error("Login mozo falló");

  // Guardamos para que el interceptor lo mande como Authorization
  localStorage.setItem("token", data.token);

  // Guardar restaurant_id para x-restaurant-id
  if (data?.user?.restaurantId != null) {
    localStorage.setItem("restaurant_id", String(data.user.restaurantId));
  }

  return data;
}

export async function ensureMozoSession({ restaurantId, pin } = {}) {
  const t = localStorage.getItem("token");
  if (t) return true;
  if (!restaurantId || !pin)
    throw new Error("Falta restaurantId o PIN para login de mozo");
  await loginMozo({ restaurantId, pin });
  return true;
}

export default FACT_API;
