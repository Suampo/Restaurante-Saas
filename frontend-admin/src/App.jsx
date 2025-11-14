// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import RequireRole from "./components/RequireRole";

// Layouts y páginas
import Sidebar from "./components/SideBar";
import Dashboard from "./pages/Dashboard";
import Mesas from "./pages/Mesas";
import Menu from "./pages/Menu";
import Pedidos from "./pages/Pedidos";
import Configuracion from "./pages/Configuracion";
import Login from "./pages/Login";
import Inventario from "./pages/Inventario";
import Reportes from "./pages/Reportes";
import Trabajadores from "./pages/admin/Trabajadores";
import AdminMovimientosEfectivo from "./pages/AdminMovimientosEfectivo";
import CobroEfectivo from "./pages/CobroEfectivo";
import MozoLayout from "./layouts/MozoLayout";

function AppLayout() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = (e) => setOpen(e.matches);
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-100">
      {/* Topbar móvil */}
      <header className="sticky top-0 z-40 flex items-center gap-2 bg-white px-4 py-3 shadow md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg border px-3 py-2 text-gray-700"
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <div className="font-semibold">Bienvenido al Panel del Administrador</div>
      </header>

      <Sidebar open={open} setOpen={setOpen} />

      <div className="relative md:pl-[var(--sb-w,256px)]">
        <main className="px-3 py-4 md:px-6 md:py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NotFound() {
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
        {/* Público: login único (admin y staff) */}
        <Route path="/login" element={<Login />} />
        {/* Alias opcional */}
        <Route path="/mozo/login" element={<Login />} />

        {/* ===== ADMIN (owner|admin) ===== */}
        <Route element={<RequireRole allow={['admin','owner']} />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="mesas" element={<Mesas />} />
            <Route path="menu" element={<Menu />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="reportes" element={<Reportes />} />
            <Route path="configuracion" element={<Configuracion />} />
            <Route path="admin/movimientos-efectivo" element={<AdminMovimientosEfectivo />} />
            <Route path="admin/trabajadores" element={<Trabajadores />} />
          </Route>
        </Route>

        {/* ===== MOZO (staff + admin/owner opcional) ===== */}
        <Route element={<RequireRole allow={['staff','admin','owner']} />}>
          <Route element={<MozoLayout />}>
            {/* Puedes dejarla absoluta o relativa; aquí relativa al layout */}
            <Route path="/mozo/cobro-efectivo" element={<CobroEfectivo />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
