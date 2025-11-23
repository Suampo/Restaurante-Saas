// src/main.jsx
import { AuthProvider } from './context/AuthProvider.jsx';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/* ==== Mitigación ZAP: limpiar ?token= de la URL ==== */
(function sanitizeUrlSearch() {
  // Solo se ejecuta en el navegador
  const url = new URL(window.location.href);
  const tokenFromUrl = url.searchParams.get("token");

  if (tokenFromUrl) {
    // 🔹 OPCIONAL: si algún día necesitas usar el token (invitación, reset, etc.),
    // lo puedes guardar de forma temporal:
    sessionStorage.setItem("inviteToken", tokenFromUrl);

    // Eliminar el parámetro de la URL para que no quede en historial/logs
    url.searchParams.delete("token");
    window.history.replaceState({}, "", url.toString());
  }
})();

const app = (
  <AuthProvider>
    <App />
  </AuthProvider>
);

const element = import.meta.env.PROD
  ? <React.StrictMode>{app}</React.StrictMode>
  : app;

ReactDOM.createRoot(document.getElementById("root")).render(element);
