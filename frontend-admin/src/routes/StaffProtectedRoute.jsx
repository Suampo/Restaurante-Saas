// src/routes/StaffProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function StaffProtectedRoute() {
  const loc = useLocation();

  // Token emitido por backend-pedidos (login normal) o mozo
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("dbToken") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    sessionStorage.getItem("dbToken");

  // Rol que guardamos con setAuthIdentity
  const role = (
    localStorage.getItem("user_role") ||
    sessionStorage.getItem("user_role") ||
    ""
  ).toLowerCase();

  // Sin token -> al login unificado
  if (!token) {
    return <Navigate to="/login" state={{ from: loc }} replace />;
  }

  // Solo pueden pasar admin o staff
  if (role !== "admin" && role !== "staff") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
