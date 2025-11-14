// src/services/axiosInstance.js
import axios from "axios";

const API = axios.create({
  baseURL: "/api",
  timeout: 20000,
  withCredentials: true,
  xsrfCookieName: "csrf_token",
  xsrfHeaderName: "x-csrf-token",
});

const getCookie = (name) => {
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
};
const isUnsafe = (m) => /^(post|put|patch|delete)$/i.test(m || "get");
const parseJwt = (t) => { try { return JSON.parse(atob(String(t).split(".")[1])); } catch { return {}; } };

// ========= REQUEST =========
API.interceptors.request.use((config) => {
  const method = String(config.method || "get").toLowerCase();

  // SOLO sessionStorage (evita tokens viejos en localStorage)
  const dbToken = sessionStorage.getItem("dbToken");
  if (dbToken) {
    config.headers = { ...(config.headers || {}) };
    if (!config.headers.Authorization)  config.headers.Authorization  = `Bearer ${dbToken}`;
    if (!config.headers["x-db-token"])  config.headers["x-db-token"] = dbToken;

    const payload = parseJwt(dbToken);
    const ridFromJwt = payload.restaurantId ?? payload.restaurant_id;
    const uidFromJwt = payload.sub ?? payload.user_id ?? payload.id;

    // 🔰 Fallbacks para que SIEMPRE vaya el restaurant_id y el user_id
    const rid =
      ridFromJwt ??
      localStorage.getItem("restaurant_id") ??
      sessionStorage.getItem("restaurant_id");
    const uid =
      uidFromJwt ??
      localStorage.getItem("user_id") ??
      sessionStorage.getItem("user_id");

    if (rid && !config.headers["x-restaurant-id"]) {
      config.headers["x-restaurant-id"] = rid;
    }
    if (uid && !config.headers["x-app-user-id"]) {
      config.headers["x-app-user-id"] = uid;
    }
  } else {
    // 🔰 Si todavía no hay dbToken, intenta enviar el restaurant_id persistido
    const rid =
      localStorage.getItem("restaurant_id") || sessionStorage.getItem("restaurant_id");
    if (rid) {
      config.headers = { ...(config.headers || {}), "x-restaurant-id": rid };
    }
  }

  if (isUnsafe(method) && !config.headers?.["x-csrf-token"]) {
    const csrf = getCookie("csrf_token");
    if (csrf) config.headers = { ...(config.headers || {}), "x-csrf-token": csrf };
  }

  return config;
});

// ========= REFRESH single-flight =========
let refreshing = null;
async function doRefresh() {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const csrf = getCookie("csrf_token");
      const r = await fetch("/api/session/refresh", {
        method: "POST",
        credentials: "include",
        headers: csrf ? { "x-csrf-token": csrf } : {},
      });
      if (!r.ok) return null;
      const j = await r.json().catch(() => ({}));
      if (!j?.dbToken) return null;
      sessionStorage.setItem("dbToken", j.dbToken);
      return j.dbToken;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

// ========= RESPONSE =========
API.interceptors.response.use(
  (r) => r,
  async (err) => {
    const res   = err?.response;
    const cfg   = err?.config || {};
    const url   = String(cfg?.url || "");
    const code  = res?.status;
    const msg   = res?.data?.error;

    const isSessionRoute = /\/session\/refresh(?:\?|$)|\/csrf(?:\?|$)/i.test(url);

    // 1) CSRF -> reintenta 1 vez
    if (code === 403 && msg === "CSRF inválido" && !cfg.__retriedCsrf) {
      cfg.__retriedCsrf = true;
      try { await fetch("/api/csrf", { credentials: "include" }); } catch {}
      const csrf = getCookie("csrf_token");
      if (csrf) cfg.headers = { ...(cfg.headers || {}), "x-csrf-token": csrf };
      return API(cfg);
    }

    // 2) 401 -> refresh + reintento (si no es /session/refresh)
    if (code === 401 && !cfg.__retried401 && !isSessionRoute) {
      cfg.__retried401 = true;

      const newTok = await doRefresh();
      if (newTok) {
        const payload = parseJwt(newTok);
        const rid = payload.restaurantId ?? payload.restaurant_id;

        cfg.headers = {
          ...(cfg.headers || {}),
          Authorization: `Bearer ${newTok}`,
          "x-db-token": newTok,
          ...(rid ? { "x-restaurant-id": rid } : {}),
        };
        const csrf2 = getCookie("csrf_token");
        if (csrf2) cfg.headers["x-csrf-token"] = csrf2;

        return API(cfg);
      }
    }

    // 3) Redirección (sólo si no hay token válido tras reintento)
    if (
      (code === 401 || code === 403) &&
      window.location.pathname !== "/login" &&
      (cfg.__retried401 || isSessionRoute) &&
      !sessionStorage.getItem("dbToken")
    ) {
      window.location.replace("/login");
    }

    return Promise.reject(err);
  }
);

export default API;
