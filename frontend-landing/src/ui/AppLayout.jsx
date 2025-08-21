// src/ui/AppLayout.jsx
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import BackgroundGlows from "./BackgroundGlows";

function ScrollToHash() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) {
      const id = hash.slice(1);
      requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [pathname, hash]);
  return null;
}

function Nav() {
  const base = "text-sm text-neutral-700 hover:text-black";
  const active = "font-semibold text-black";

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
        {/* Marca fija: no se encoge */}
        <NavLink to="/" className="shrink-0 text-lg font-bold tracking-tight">
          MikhunApp
        </NavLink>

        {/* Contenedor elástico del nav que NO expande el ancho de la página */}
        <div className="min-w-0 grow">
          <nav
            className="
              flex items-center gap-4 text-sm
              overflow-x-auto whitespace-nowrap
              sm:overflow-visible
              [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden
            "
          >
            <NavLink to="/" end className={({ isActive }) => (isActive ? active : base)}>
              Inicio
            </NavLink>
            <NavLink to="/#services" className={({ isActive }) => (isActive ? active : base)}>
              Servicios
            </NavLink>
            <NavLink to="/#features" className={({ isActive }) => (isActive ? active : base)}>
              Funciones
            </NavLink>
            <NavLink to="/#prices" className={({ isActive }) => (isActive ? active : base)}>
              Precios
            </NavLink>
            <NavLink to="/contacto" className={({ isActive }) => (isActive ? active : base)}>
              Contacto
            </NavLink>

            {/* CTA: pegado a la derecha del carril y sin encogerse */}
            <Link
              to="/registro"
              className="ml-auto shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-white font-medium hover:bg-emerald-500"
            >
              Crear cuenta
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 grid gap-6 sm:grid-cols-3">
        <div>
          <div className="text-lg font-bold">Mikhunapp</div>
          <p className="mt-2 text-sm text-neutral-600">
            Pedidos por QR, pago online y comanda automática. SaaS para restaurantes.
          </p>
        </div>
        <div>
          <div className="font-semibold">Legal</div>
          <ul className="mt-2 space-y-1 text-sm">
            <li><a className="hover:underline" href="/legal/terminos">Términos y Condiciones</a></li>
            <li><a className="hover:underline" href="/legal/privacidad">Política de Privacidad</a></li>
            <li><a className="hover:underline" href="/legal/devoluciones">Cambios y Devoluciones</a></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold">Empresa</div>
          <p className="mt-2 text-sm text-neutral-600">
            Razón social · RUC 10778055070<br/>
            Lima, Lima, Perú<br/>
            mikhunappfood@gmail.com · +51 950 809 208
          </p>
          <p className="mt-3 text-xs text-neutral-500">
            Pagos procesados de forma segura con Culqi u otra pasarela de Pago.
          </p>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-neutral-500">
        © {new Date().getFullYear()} Mikhunapp. Todos los derechos reservados.
      </div>
    </footer>
  );
}

export default function AppLayout() {
  return (
    <div className="min-h-svh bg-neutral-50 text-neutral-900 relative">
      <BackgroundGlows />
      <ScrollToHash />
      <Nav />
      <Outlet />
      <Footer />
    </div>
  );
}
