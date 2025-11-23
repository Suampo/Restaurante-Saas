// src/components/SideBar.jsx
import { NavLink } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Home, List, Utensils, ShoppingCart, Boxes, TrendingUp, LogOut,
  ChevronsLeft, ChevronsRight, X, CookingPot, Users,FileText
} from "lucide-react";
import API from "../services/axiosInstance";

// --- Sub-componente para los elementos de navegación (Estilo Oscuro) ---
function NavItem({ to, icon: Icon, label, collapsed, onClick }) {
  const baseClasses = "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/80";
  const navLinkClasses = ({ isActive }) => [
    baseClasses,
    isActive
      ? "bg-zinc-800 text-green-400 font-semibold"
      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50",
    collapsed && "justify-center",
  ].join(" ");

  return (
    <li>
      <NavLink to={to} end className={navLinkClasses} onClick={onClick}>
        <Icon size={20} className="shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
        {collapsed && (
          <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-lg ring-1 ring-zinc-800 group-hover:block z-50">
            {label}
          </span>
        )}
      </NavLink>
    </li>
  );
}

// --- Componente Principal ---
export default function SideBar({ open, setOpen }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sb:collapsed") === "1");

  useEffect(() => { localStorage.setItem("sb:collapsed", collapsed ? "1" : "0"); }, [collapsed]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
  useEffect(() => {
    const apply = () => {
      if (window.matchMedia("(min-width: 768px)").matches) {
        const w = collapsed ? 80 : 256;
        document.documentElement.style.setProperty("--sb-w", `${w}px`);
      } else {
        document.documentElement.style.setProperty("--sb-w", "0px");
      }
    };
    apply();
    const mq = window.matchMedia("(min-width: 768px)");
    mq.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      mq.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, [collapsed]);

  const menus = useMemo(() => ([
    { label: "Inicio",          icon: Home,         to: "/dashboard" },
    { label: "Mesas",           icon: List,         to: "/mesas" },
    { label: "Menú",            icon: Utensils,     to: "/menu" },
    { label: "Pedidos",         icon: ShoppingCart, to: "/pedidos" },
    { label: "Inventario",      icon: Boxes,        to: "/inventario" },
    { label: "Reportes",        icon: TrendingUp,   to: "/reportes" },
    { label: "Mov. efectivo",   icon: TrendingUp,   to: "/admin/movimientos-efectivo" },
    { label: "Trabajadores",    icon: Users,        to: "/admin/trabajadores" },
    { label: "Facturación",     icon: FileText,     to: "/admin/facturacion" },
  ]), []);

  const handleLogout = useCallback(async () => {
    try { await API.post("/auth/logout"); }
    catch (e) { console.warn("logout:", e?.response?.data || e.message); }
    finally {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.replace("/login");
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
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* Barra Lateral */}
      <aside
        aria-label="Barra lateral de navegación"
        className={[
          "fixed inset-y-0 left-0 z-40 flex h-[100svh] flex-col",
          "bg-zinc-900 border-r border-zinc-800",
          "transition-[transform,width] duration-300 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full",
          "md:translate-x-0",
          collapsed ? "w-20" : "w-64",
        ].join(" ")}
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white shadow-md">
              <CookingPot size={20} />
            </div>
            {!collapsed && <span className="text-base font-bold tracking-tight text-zinc-50">Mi Negocio</span>}
          </div>
          <div>
            <button
              onClick={() => setCollapsed((v) => !v)}
              className="hidden rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 md:inline-flex"
              title={collapsed ? "Expandir" : "Colapsar"}
            >
              {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50 md:hidden"
              aria-label="Cerrar barra lateral"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Navegación Principal */}
        <nav className="flex-grow overflow-y-auto p-2">
          <ul role="list" className="space-y-1">
            {menus.map((menu) => (
              <NavItem key={menu.to} {...menu} collapsed={collapsed} onClick={closeOnMobile} />
            ))}
          </ul>
        </nav>

        {/* Pie de Barra (Logout) */}
        <footer className="shrink-0 border-t border-zinc-800 p-2">
          <button
            onClick={() => { closeOnMobile(); handleLogout(); }}
            className={[
              "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              "text-rose-500 hover:bg-rose-500/10 hover:text-rose-400",
              collapsed && "justify-center"
            ].join(" ")}
          >
            <LogOut size={20} className="shrink-0" />
            {!collapsed && <span>Cerrar sesión</span>}
            {collapsed && (
              <span className="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-zinc-950 px-2 py-1 text-xs text-zinc-100 shadow-lg ring-1 ring-zinc-800 group-hover:block z-50">
                Cerrar sesión
              </span>
            )}
          </button>
        </footer>
      </aside>
    </>
  );
}
