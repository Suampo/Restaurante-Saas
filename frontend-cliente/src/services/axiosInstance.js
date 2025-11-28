// frontend-cñiente/src/services/axiosInstance.js
import axios from "axios";

const API = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "http://localhost:4000/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// helper para leer la cookie de CSRF sembrada por tu backend
function getCookie(name) {
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

// inyecta CSRF en todas las mutaciones
API.interceptors.request.use((cfg) => {
  const method = (cfg.method || "get").toLowerCase();
  if (method !== "get" && method !== "head") {
    const csrf = getCookie("csrf_token");
    if (csrf) cfg.headers["X-CSRF-Token"] = csrf;
  }
  return cfg;
});

export default API;
