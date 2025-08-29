// src/ui/AppLayout.jsx
import { Outlet, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import BackgroundGlows from "./BackgroundGlows";

function ScrollToHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const goTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

    if (!hash) {
      goTop();
      return;
    }

    const id = hash.slice(1);
    const el = document.getElementById(id);
    if (!el) return;

    // Compensar altura del header (usa la CSS var --header-h)
    const rootStyle = getComputedStyle(document.documentElement);
    const hh = parseInt(rootStyle.getPropertyValue("--header-h")) || 56;
    const extra = 8;
    const y = el.getBoundingClientRect().top + window.scrollY - hh - extra;

    window.scrollTo({ top: y, behavior: "smooth" });
  }, [pathname, hash]);

  return null;
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-neutral-50 text-neutral-900 relative">
      <BackgroundGlows />
      <ScrollToHash />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16">
          <Link to="/" className="text-lg font-bold tracking-tight">MikhunApp</Link>

          {/* Nav desktop */}
          <nav className="hidden sm:flex items-center gap-6 text-sm">
  <Link to="/#services" className="hover:text-emerald-700">Servicios</Link>
  <Link to="/#features" className="hover:text-emerald-700">Funciones</Link>
  <Link to="/#prices"   className="hover:text-emerald-700">Precios</Link>
  <Link to="/contacto"  className="hover:text-emerald-700">Contacto</Link>
</nav>


          {/* CTA desktop */}
          <div className="hidden sm:flex items-center">
            <Link
              to="/registro"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
            >
              Crear cuenta
            </Link>
          </div>

          {/* Hamburguesa móvil */}
          <button
            className="sm:hidden rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
        </div>
      </header>

      {/* Drawer móvil */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white p-4 shadow-xl overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Menú</span>
              <button onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
            </div>
           <nav className="grid gap-3 text-base">
  <Link to="/#services" onClick={() => setOpen(false)}>Servicios</Link>
  <Link to="/#features" onClick={() => setOpen(false)}>Funciones</Link>
  <Link to="/#prices"   onClick={() => setOpen(false)}>Precios</Link>
  <Link to="/contacto"  onClick={() => setOpen(false)}>Contacto</Link>
  <Link
    to="/registro"
    className="mt-2 rounded-xl border border-neutral-300 px-4 py-2 text-center"
    onClick={() => setOpen(false)}
  >
    Crear cuenta
  </Link>
</nav>

          </aside>
        </div>
      )}

      {/* Contenido */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
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
              <li><Link className="hover:underline" to="/legal/terminos">Términos y Condiciones</Link></li>
              <li><Link className="hover:underline" to="/legal/privacidad">Política de Privacidad</Link></li>
              <li><Link className="hover:underline" to="/legal/devoluciones">Cambios y Devoluciones</Link></li>
              <li><Link className="hover:underline" to="/libro-de-reclamaciones">Libro de Reclamaciones</Link></li>
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
    </div>
  );
}
