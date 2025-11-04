// src/services/cashApi.js
import axios from "axios";

// ---- BASES ----
const FACT_BASE =
  import.meta.env.VITE_FACT_API_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000";

const SPLIT_BASE = "/api/split";   // rutas de split
const ADMIN_BASE = "/admin";       // rutas admin

export const FACT_API = axios.create({
  baseURL: FACT_BASE,
  withCredentials: true,
  timeout: 20000,
});

let gotCsrf = false;

// ---- utils ----
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export function setAuthIdentity({ email, id, role, restaurantId } = {}) {
  if (email) localStorage.setItem("user_email", email); else localStorage.removeItem("user_email");
  if (id) localStorage.setItem("user_id", id); else localStorage.removeItem("user_id");
  if (role) localStorage.setItem("user_role", role); else localStorage.removeItem("user_role");
  if (restaurantId != null) localStorage.setItem("restaurant_id", String(restaurantId));
}
export function clearAuthIdentity() { setAuthIdentity({}); }

FACT_API.interceptors.request.use(async (config) => {
  // Bearer opcional
  const bearer =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");
  if (bearer) config.headers.Authorization = `Bearer ${bearer}`;

  // Trazabilidad
  const userEmail = localStorage.getItem("user_email") || sessionStorage.getItem("user_email");
  const userId    = localStorage.getItem("user_id")    || sessionStorage.getItem("user_id");
  const userRole  = localStorage.getItem("user_role")  || sessionStorage.getItem("user_role");
  const restaurantId = localStorage.getItem("restaurant_id") || sessionStorage.getItem("restaurant_id");

  if (userEmail)    config.headers["x-app-user"] = userEmail;
  if (userId)       config.headers["x-app-user-id"] = userId;
  if (userRole)     config.headers["x-user-role"] = userRole;
  if (restaurantId) config.headers["x-restaurant-id"] = restaurantId;

  // CSRF solo para split/checkout
  const url = typeof config.url === "string" ? config.url : "";
  const needsCsrf = url.startsWith(SPLIT_BASE) || url.startsWith("/api/checkout");
  if (needsCsrf) {
    let token = getCookie("csrf_token");
    if (!token && !gotCsrf) {
      await axios.get(`${FACT_BASE}/api/csrf`, { withCredentials: true });
      token = getCookie("csrf_token");
      gotCsrf = true;
    }
    if (token) config.headers["x-csrf-token"] = token;
  }
  return config;
});

FACT_API.interceptors.response.use(
  (r) => r,
  async (error) => {
    const cfg = error?.config || {};
    const status = error?.response?.status;
    const isCsrf = status === 403 && !cfg.__retriedCsrf;
    if (isCsrf) {
      try {
        await axios.get(`${FACT_BASE}/api/csrf`, { withCredentials: true });
        cfg.__retriedCsrf = true;
        return FACT_API(cfg);
      } catch {}
    }
    throw error;
  }
);

// ----------------- API -----------------
export async function getSaldo(pedidoId) {
  const { data } = await FACT_API.get(`${SPLIT_BASE}/pedidos/${pedidoId}/saldo`);
  return data;
}

export async function crearPagoEfectivo(pedidoId, { amount, received, note }) {
  const { data } = await FACT_API.post(
    `${SPLIT_BASE}/pedidos/${pedidoId}/pagos/efectivo`,
    { amount, received, note }
  );
  return data;
}

export async function aprobarPagoEfectivo(pedidoId, pagoId, { pin, received, note }) {
  const { data } = await FACT_API.post(
    `${SPLIT_BASE}/pedidos/${pedidoId}/pagos/${pagoId}/aprobar`,
    { pin, received, note }
  );
  return data;
}

// Normalizador de estado para el filtro
const mapEstado = (v) => {
  const s = String(v || "").trim().toLowerCase();
  if (["", "*", "todos", "todo", "all"].includes(s)) return undefined; // no enviar => todos
  if (["aprobado", "aprobados", "approved"].includes(s)) return "approved";
  if (["pendiente", "pendientes", "pending"].includes(s)) return "pending";
  return undefined;
};
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function listarMovimientosEfectivo({ start, end, estado, userId } = {}) {
  const params = {};
  if (start) params.start = start;
  if (end) params.end = end;

  const est = mapEstado(estado);
  if (est) params.estado = est;

  if (userId && UUID_RE.test(userId)) params.userId = userId;

  const { data } = await FACT_API.get(`${ADMIN_BASE}/cash-movements`, { params });
  return data;
}

export default FACT_API;
