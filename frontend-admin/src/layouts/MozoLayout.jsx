// src/layouts/MozoLayout.jsx
import { Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

export default function MozoLayout() {
  const { logout } = useAuth();

  const handleSalir = async () => {
    try {
      // Cierra sesión correctamente: limpia token local y cookie httpOnly con CSRF
      await logout();
    } finally {
      // Fuerza ir al login unificado y evita que el Back del navegador “reviva” la sesión
      window.location.replace("/login");
      // Si prefieres React Router:
      // navigate("/login", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-4 py-3 shadow">
        <div className="font-semibold">Panel del Mozo</div>
        <button onClick={handleSalir} className="rounded border px-3 py-1.5">
          Salir
        </button>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
