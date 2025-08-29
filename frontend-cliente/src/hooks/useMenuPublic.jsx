import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { fetchRestaurantName, fetchRestaurantSettings } from "../services/restaurantApi";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:4000";
const MenuCtx = createContext(null);

export function MenuProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [combos, setCombos] = useState([]);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [settings, setSettings] = useState(null);

  const params = new URLSearchParams(location.search);
  const restaurantId = Number(params.get("restaurantId") || 1);
  const mesaId   = Number(params.get("mesaId") || 0);
  const mesaCode = params.get("mesaCode") || null;

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const [menuRes, name, setts] = await Promise.all([
          axios.get(`${API_BASE}/api/menu/public?restaurantId=${restaurantId}`, { signal: ctrl.signal }),
          fetchRestaurantName(restaurantId, { signal: ctrl.signal }),
          fetchRestaurantSettings(restaurantId, { signal: ctrl.signal }).catch(() => null),
        ]);
        const data = menuRes.data || {};
        setCategories(Array.isArray(data?.categories) ? data.categories : []);
        setCombos(Array.isArray(data?.combos) ? data.combos : []);
        setRestaurantName(name || "");
        setSettings(setts || null);
        setError("");
      } catch (e) {
        if (e.name === "CanceledError" || e.name === "AbortError") return;
        setError(e?.message || "No se pudo cargar el menú");
        setCategories([]); setCombos([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [restaurantId]);

  const value = useMemo(
    () => ({ loading, error, categories, combos, restaurantId, mesaId, mesaCode, restaurantName, settings }),
    [loading, error, categories, combos, restaurantId, mesaId, mesaCode, restaurantName, settings]
  );

  return <MenuCtx.Provider value={value}>{children}</MenuCtx.Provider>;
}

export function useMenuPublic() {
  const ctx = useContext(MenuCtx);
  if (!ctx) throw new Error("useMenuPublic debe usarse dentro de <MenuProvider>");
  return ctx;
}
