// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useEffect, useState, Suspense, lazy } from "react";
import RequireRole from "./components/RequireRole";

// Layouts y componentes que se usan siempre (no lazy)
import Sidebar from "./components/SideBar";
import MozoLayout from "./layouts/MozoLayout";

/** ========= PÁGINAS LAZY ========= **/
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Mesas = lazy(() => import("./pages/Mesas"));
const Menu = lazy(() => import("./pages/Menu"));
const Pedidos = lazy(() => import("./pages/Pedidos"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const Login = lazy(() => import("./pages/Login"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Reportes = lazy(() => import("./pages/Reportes"));
const Trabajadores = lazy(() => import("./pages/admin/Trabajadores"));
const AdminMovimientosEfectivo = lazy(() => import("./pages/AdminMovimientosEfectivo"));
const CobroEfectivo = lazy(() => import("./pages/CobroEfectivo"));
const Facturacion = lazy(() => import("./pages/Facturacion"));

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

function FullPageLoader() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-green-500" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      {/* 👇 Todo lo que depende de páginas va dentro de Suspense */}
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          {/* Público: login único (admin y staff) */}
          <Route path="/login" element={<Login />} />
          {/* Alias opcional */}
          <Route path="/mozo/login" element={<Login />} />

          {/* ===== ADMIN (owner|admin) ===== */}
          <Route element={<RequireRole allow={["admin", "owner"]} />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="mesas" element={<Mesas />} />
              <Route path="menu" element={<Menu />} />
              <Route path="pedidos" element={<Pedidos />} />
              <Route path="inventario" element={<Inventario />} />
              <Route path="reportes" element={<Reportes />} />
              <Route path="configuracion" element={<Configuracion />} />
              <Route
                path="admin/movimientos-efectivo"
                element={<AdminMovimientosEfectivo />}
              />
              <Route path="admin/trabajadores" element={<Trabajadores />} />
              {/* Dejas esta ruta absoluta tal como la tenías */}
              <Route path="/admin/facturacion" element={<Facturacion />} />
            </Route>
          </Route>

          {/* ===== MOZO (staff + admin/owner opcional) ===== */}
          <Route element={<RequireRole allow={["staff", "admin", "owner"]} />}>
            <Route element={<MozoLayout />}>
              <Route path="/mozo/cobro-efectivo" element={<CobroEfectivo />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
