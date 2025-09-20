// src/components/SideBar.jsx
import { NavLink, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home, List, Utensils, ShoppingCart, Boxes, TrendingUp, LogOut,
  ChevronsLeft, ChevronsRight, X
} from "lucide-react";
import API from "../services/axiosInstance"; // 👈 necesario para llamar /auth/logout

const baseItem =
  "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/60";

export default function SideBar({ open, setOpen }) {
  const { pathname } = useLocation();

  // Colapsado en desktop (persistente)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sb:collapsed") === "1");
  useEffect(() => {
    localStorage.setItem("sb:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Cerrar con ESC en móvil
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  // Expone el ancho a --sb-w para padding dinámico del layout
  useEffect(() => {
    const apply = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        const w = collapsed ? 80 : 256; // w-20 / w-64
        document.documentElement.style.setProperty("--sb-w", `${w}px`);
      } else {
        document.documentElement.style.setProperty("--sb-w", "0px");
      }
    };
    apply();
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [collapsed]);

  const menus = useMemo(() => ([
    { name: "Inicio",     icon: Home,         link: "/dashboard" },
    { name: "Mesas",      icon: List,         link: "/mesas" },
    { name: "Menú",       icon: Utensils,     link: "/menu" },
    { name: "Pedidos",    icon: ShoppingCart, link: "/pedidos" },
    { name: "Inventario", icon: Boxes,        link: "/inventario" },
    { name: "Reportes",   icon: TrendingUp,   link: "/reportes" },
  ]), []);

  // 👇 Cierra sesión en el backend (borra cookie HttpOnly) y redirige
  const handleLogout = useCallback(async () => {
    try {
      await API.post("/auth/logout"); // borra access_token + csrf_token en el servidor
    } catch (e) {
      console.warn("logout:", e?.response?.data || e.message);
    } finally {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.replace("/login"); // recarga limpia y evita volver al dashboard
    }
  }, []);

  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 767px)").matches) setOpen(false);
  };

  return (
    <>
      {/* Overlay (móvil) */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-30 bg-black/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        aria-label="Barra lateral de navegación"
        className={[
          "fixed inset-y-0 left-0 z-40 h-[100svh] border-r border-white/10 bg-gradient-to-b from-[#0b1220] to-[#121a2b] text-slate-100 shadow-xl backdrop-blur-sm",
          "transition-[transform,width] duration-300",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          collapsed ? "w-20" : "w-64",
        ].join(" ")}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-green-500/20 ring-1 ring-green-400/40" />
            {!collapsed && <span className="text-sm font-semibold tracking-wide">Restaurante</span>}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="hidden rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/60 md:inline-flex"
              aria-label={collapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
              title={collapsed ? "Expandir" : "Colapsar"}
            >
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/60 md:hidden"
              aria-label="Cerrar barra lateral"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navegación */}
        <nav className="mt-1 flex h-[calc(100svh-120px)] flex-col gap-1 overflow-y-auto px-2 pb-2">
          <ul role="list" className="space-y-1">
            {menus.map(({ name, icon: Icon, link }) => (
              <li key={link}>
                <NavLink
                  to={link}
                  end
                  onClick={closeOnMobile}
                  className={({ isActive }) =>
                    [
                      baseItem,
                      isActive
                        ? "bg-white/5 text-white ring-1 ring-inset ring-white/10 border-l-2 border-green-400 shadow-inner"
                        : "text-slate-300 hover:bg-white/5 hover:text-white",
                      collapsed && "justify-center",
                    ].join(" ")
                  }
                  aria-current={pathname === link ? "page" : undefined}
                >
                  <Icon size={20} className="shrink-0" />
                  {!collapsed && <span className="truncate">{name}</span>}
                  {/* Tooltip al colapsar */}
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full ml-2 hidden whitespace-nowrap rounded-md bg-[#0f172a] px-2 py-1 text-xs text-slate-100 shadow-lg ring-1 ring-black/40 group-hover:block">
                      {name}
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Cerrar sesión */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <button
            onClick={() => { closeOnMobile(); handleLogout(); }}
            className={[
              baseItem,
              "w-full text-rose-300 hover:bg-rose-500/10 hover:text-rose-100",
              collapsed && "justify-center",
            ].join(" ")}
          >
            <LogOut className="h-5 w-5" />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
