// src/routes/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthProvider';

export default function ProtectedRoute() {
  const { dbToken, ready } = useAuth();
  const token = dbToken || (typeof window !== 'undefined' ? sessionStorage.getItem('dbToken') : null);
  const loc = useLocation();

  // Espera a que AuthProvider termine de bootstrapear (evita el “rebote”)
  if (!ready) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <span className="text-neutral-500 text-sm">Cargando…</span>
      </div>
    );
  }

  return token ? <Outlet /> : <Navigate to="/login" replace state={{ from: loc }} />;
}
