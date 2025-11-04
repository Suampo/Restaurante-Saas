import { Navigate, Outlet, useLocation } from "react-router-dom";

export default function StaffProtectedRoute() {
  const loc = useLocation();

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem("access_token");

  const role = (localStorage.getItem("role") || sessionStorage.getItem("role") || "").toLowerCase();

  if (!token) {
    return <Navigate to="/mozo/login" state={{ from: loc }} replace />;
  }

  if (role !== "staff" && role !== "admin") {
    return <Navigate to="/mozo/login" replace />;
  }

  return <Outlet />;
}
