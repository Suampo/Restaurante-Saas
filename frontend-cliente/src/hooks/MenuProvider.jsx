import React, { createContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { apiGetPublicConfig } from "../services/api.js";

// Config base API
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export const MenuPublicCtx = createContext(null);

// Agrupa items planos por categoria_id
function groupItemsByCategory(items = [], cats = []) {
  const byId = new Map(Array.isArray(cats) ? cats.map(c => [c.id, { ...c, items: [] }]) : []);
  items.forEach(it => {
    const catId = it.categoria_id ?? -1;
    if (!byId.has(catId)) byId.set(catId, { id: catId, nombre: "Otros", cover_url: null, items: [] });
    byId.get(catId).items.push(it);
  });
  return Array.from(byId.values()).filter(c => c.items.length > 0);
}

export default function MenuProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [combos, setCombos] = useState([]);
  const [error, setError] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [billingMode, setBillingMode] = useState("none");

  const params = new URLSearchParams(location.search);
  const restaurantId = Number(params.get("restaurantId") || 1);
  const mesaId = Number(params.get("mesaId") || 0);
  const mesaCode = params.get("mesaCode") || null;

  // Rehidrata cache para pintar instantáneo
  useEffect(() => {
    const key = `menu_public_${restaurantId}`;
    const cached = sessionStorage.getItem(key);
    if (cached) {
      try {
        const j = JSON.parse(cached);
        if (j?.categories) setCategories(j.categories);
        if (j?.combos) setCombos(j.combos);
        if (j?.restaurantName) setRestaurantName(j.restaurantName);
        setLoading(false);
      } catch {}
    }
  }, [restaurantId]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setError("");

        const menuPromise = axios.get(`${API_BASE}/api/public/menu`, {
          params: { restaurantId },
          signal: ctrl.signal,
          headers: { Accept: "application/json" },
        });
        const cfgPromise = apiGetPublicConfig(restaurantId).catch(() => null);

        // MENÚ primero
        const menuRes = await menuPromise;
        const raw = menuRes.data;

        let nextCategories = [];
        let nextCombos = [];

        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          nextCategories = Array.isArray(raw.categories) ? raw.categories : [];
          nextCombos = Array.isArray(raw.combos) ? raw.combos : [];
        } else if (Array.isArray(raw)) {
          nextCategories = groupItemsByCategory(raw);
          nextCombos = [];
        }

        setCategories(nextCategories);
        setCombos(nextCombos);
        setLoading(false);

        sessionStorage.setItem(
          `menu_public_${restaurantId}`,
          JSON.stringify({ categories: nextCategories, combos: nextCombos, restaurantName })
        );

        // CONFIG después
        const cfg = await cfgPromise;
        if (cfg) {
          setRestaurantName(cfg?.name || cfg?.nombre || "");
          setBillingMode(cfg?.billingMode || "none");
          try {
            const k = `menu_public_${restaurantId}`;
            const prev = JSON.parse(sessionStorage.getItem(k) || "{}");
            sessionStorage.setItem(k, JSON.stringify({ ...prev, restaurantName: cfg?.name || cfg?.nombre || "" }));
          } catch {}
        }
      } catch (e) {
        if (e?.name === "AbortError" || e?.name === "CanceledError") return;
        const msg =
          e?.response?.data?.error ||
          e?.response?.data?.message ||
          e?.message ||
          "No se pudo cargar el menú";
        setError(msg);
        setCategories([]); setCombos([]);
        setRestaurantName(""); setBillingMode("none");
        setLoading(false);
      }
    })();
    return () => ctrl.abort();
  }, [restaurantId]);

  const value = useMemo(
    () => ({
      loading, error, categories, combos,
      restaurantId, mesaId, mesaCode,
      restaurantName, billingMode,
    }),
    [loading, error, categories, combos, restaurantId, mesaId, mesaCode, restaurantName, billingMode]
  );

  return <MenuPublicCtx.Provider value={value}>{children}</MenuPublicCtx.Provider>;
}
