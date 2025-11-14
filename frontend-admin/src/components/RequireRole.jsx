// src/components/RequireRole.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

/**
 * Guard por rol. Soporta ambos usos:
 * 1) Wrapper con children:
 *    <RequireRole allow={['admin']}><Dashboard/></RequireRole>
 * 2) Element de <Route> con Outlet:
 *    <Route element={<RequireRole allow={['admin']} />}> ... </Route>
 */
export default function RequireRole({ allow = [], children }) {
  const { role, ready } = useAuth();
  const loc = useLocation();

  if (!ready) return null; // loader opcional
  if (!role) return <Navigate to="/login" state={{ from: loc }} replace />;

  if (allow.length > 0 && !allow.includes(role)) {
    const fallback = role === "staff" ? "/mozo/cobro-efectivo" : "/dashboard";
    return <Navigate to={fallback} replace />;
  }

  return children ?? <Outlet />;
}
