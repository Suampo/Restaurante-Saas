// src/services/axiosInstance.js
import axios from "axios";

// Siempre usa el proxy de Vite: baseURL relativa → cookies httpOnly quedan en 5173.
const API = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true,
  xsrfCookieName: "csrf_token",
  xsrfHeaderName: "x-csrf-token", // tu middleware lee en minúsculas
});

// ---- helpers
const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};
const isUnsafe = (m) => /^(post|put|patch|delete)$/i.test(m || "get");
const parseJwt = (t) => { try { return JSON.parse(atob(String(t).split(".")[1])); } catch { return {}; } };

// ========== REQUEST ==========
API.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();

  // 1) Token RLS (dbToken) desde sessionStorage/localStorage
  const dbToken =
    sessionStorage.getItem("dbToken") || localStorage.getItem("dbToken");
  if (dbToken) {
    config.headers = { ...(config.headers || {}) };
    if (!config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${dbToken}`;
    }
    // Algunas rutas del back leen un header propio
    if (!config.headers["x-db-token"]) {
      config.headers["x-db-token"] = dbToken;
    }
    // Útil para back que filtra por restaurante (acepta camel o snake)
    const payload = parseJwt(dbToken);
    const rid = payload.restaurantId ?? payload.restaurant_id;
    if (rid && !config.headers["x-restaurant-id"]) {
      config.headers["x-restaurant-id"] = rid;
    }
  }

  // 2) CSRF solo en métodos mutables
  if (isUnsafe(method) && !config.headers?.["x-csrf-token"]) {
    const csrf = getCookie("csrf_token");
    if (csrf) {
      config.headers = { ...(config.headers || {}), "x-csrf-token": csrf };
    }
  }

  return config;
});

// ========== RESPONSE ==========
API.interceptors.response.use(
  (r) => r,
  async (err) => {
    const res = err?.response;
    const cfg = err?.config || {};
    const status = res?.status;
    const msg = res?.data?.error;

    // 1) Si falla por CSRF, siembra y reintenta 1 vez
    if (status === 403 && msg === "CSRF inválido" && !cfg.__retriedCsrf) {
      cfg.__retriedCsrf = true;
      try { await fetch("/api/csrf", { credentials: "include" }); } catch {}
      const csrf = getCookie("csrf_token");
      if (csrf) {
        cfg.headers = { ...(cfg.headers || {}), "x-csrf-token": csrf };
      }
      return API(cfg);
    }

    // 2) Si falla por 401, intenta renovar el dbToken con la cookie httpOnly y reintenta 1 vez
    if (status === 401 && !cfg.__retried401) {
      cfg.__retried401 = true;
      try {
        const csrf = getCookie("csrf_token");
        const r = await fetch("/api/session/refresh", {
          method: "POST",
          credentials: "include",
          headers: csrf ? { "x-csrf-token": csrf } : {},
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j?.dbToken) {
          sessionStorage.setItem("dbToken", j.dbToken);
          cfg.headers = {
            ...(cfg.headers || {}),
            Authorization: `Bearer ${j.dbToken}`,
            "x-db-token": j.dbToken,
          };
          const csrf2 = getCookie("csrf_token");
          if (csrf2) cfg.headers["x-csrf-token"] = csrf2;
          return API(cfg);
        }
      } catch {}
    }

    // 3) Cualquier 401/403 que no se pueda recuperar → vuelve a /login
    if (status === 401 || status === 403) {
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
    }

    return Promise.reject(err);
  }
);

export default API;
