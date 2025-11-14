// src/AnimatedRoutes.jsx
import { Routes, Route, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useEffect } from "react";

import Home from "./pages/Home";
import Category from "./pages/Category";
import Combo from "./pages/Combo";

// Variantes de página
const page = {
  initial: (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  animate:  { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" } },
  exit:     (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40, transition: { duration: 0.18, ease: "easeIn" } }),
};

export default function AnimatedRoutes() {
  const location = useLocation();
  const navType = useNavigationType(); // 'PUSH' | 'POP' | 'REPLACE'

  // Dirección robusta: PUSH -> 1 (entra desde derecha), POP (volver) -> -1 (entra desde izquierda)
  const direction = useMemo(() => (navType === "POP" ? -1 : 1), [navType]);

  // Detecta si realmente cambió la RUTA (pathname) para animar SOLO entonces
  const prevPathRef = useRef(location.pathname);
  const isRouteChange = prevPathRef.current !== location.pathname;
  useEffect(() => { prevPathRef.current = location.pathname; }, [location.pathname]);

  const MotionPage = ({ children }) => (
    <motion.div
      className="min-h-svh bg-white"
      style={{ willChange: "transform, opacity" }}
      variants={page}
      // Evita animar en renders normales (botones, abrir/cerrar modales, agregar al carrito, etc.)
      initial={isRouteChange ? "initial" : false}
      animate="animate"
      exit={isRouteChange ? "exit" : undefined}
      custom={direction}
    >
      {children}
    </motion.div>
  );

  // Scrollea arriba SOLO cuando cambias de ruta (no al cerrar modales, etc.)
  const routeChangedRef = useRef(false);
  useEffect(() => { routeChangedRef.current = true; }, [location.pathname]);

  return (
    <AnimatePresence
      mode="wait"
      initial={false}
      presenceAffectsLayout={false}
      onExitComplete={() => {
        if (routeChangedRef.current) {
          routeChangedRef.current = false;
          window.scrollTo({ top: 0, behavior: "auto" });
        }
      }}
    >
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<MotionPage><Home /></MotionPage>} />
        <Route path="/categoria/:id" element={<MotionPage><Category /></MotionPage>} />
        <Route path="/combo" element={<MotionPage><Combo /></MotionPage>} />
      </Routes>
    </AnimatePresence>
  );
}
