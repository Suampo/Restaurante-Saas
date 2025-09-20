// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Sidebar from "./components/SideBar";
import Dashboard from "./pages/Dashboard";
import Mesas from "./pages/Mesas";
import Menu from "./pages/Menu";
import Pedidos from "./pages/Pedidos";
import Configuracion from "./pages/Configuracion";
import Login from "./pages/Login";
import ProtectedRoute from "./routes/ProtectedRoute";
import Inventario from "./pages/Inventario";
import Reportes from "./pages/Reportes";

function AppLayout() {
  const [open, setOpen] = useState(false);

  // Abrir/cerrar en función del breakpoint (móvil/desktop)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = (e) => setOpen(e.matches);
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    // 👇 corta cualquier desbordamiento horizontal del off-canvas
    <div className="min-h-screen overflow-x-hidden bg-gray-100">
      {/* Topbar solo en móvil */}
      <header className="sticky top-0 z-40 flex items-center gap-2 bg-white px-4 py-3 shadow md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border px-3 py-2 text-gray-700"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <div className="font-semibold">Restaurante</div>
      </header>

      {/* Sidebar fijo + contenido con padding izq dinámico en desktop */}
      <Sidebar open={open} setOpen={setOpen} />

      {/* 👇 reserva el ancho del sidebar en desktop usando --sb-w */}
      <div className="relative md:pl-[var(--sb-w,256px)]">
        <main className="px-3 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  // 404 simple para evitar otra redirección más
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">404</h1>
        <p className="text-neutral-600">Página no encontrada.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* pública */}
        <Route path="/login" element={<Login />} />

        {/* privada */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* ÚNICA redirección automática */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mesas" element={<Mesas />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/inventario" element={<Inventario />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>

        {/* nada de enviar a /dashboard otra vez; mostramos 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
