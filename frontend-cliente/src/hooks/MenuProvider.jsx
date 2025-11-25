// src/hooks/MenuProvider.jsx
import React, { createContext, useEffect, useMemo, useState } from "react";
import { fetchRestaurant } from "../services/restaurantApi.js";

// Base del backend de pedidos
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

export const MenuPublicCtx = createContext(null);

function readUrlParams() {
  const p = new URLSearchParams(location.search);
  return {
    restaurantId: Number(p.get("restaurantId") || 1),
    mesaId: p.get("mesaId") ? Number(p.get("mesaId")) : null,
    mesaCode: p.get("mesaCode") || null,
  };
}

const isAbs = (u = "") =>
  /^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("blob:");
const toAbs = (u = "") =>
  isAbs(u) ? u : `${API_BASE}${u.startsWith("/") ? "" : "/"}${u}`;

/**
 * Carga el menú público
 */
async function fetchMenuPublic(restaurantId) {
  const url = `${API_BASE}/api/public/menu?restaurantId=${restaurantId}`;
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

export default function MenuProvider({ children }) {
  const { restaurantId, mesaId, mesaCode } = readUrlParams();

  const [state, setState] = useState({
    loading: true,
    error: "",
    restaurantName: "",
    billingMode: "none",
    restaurantCoverUrl: null,
    // 👇 1. INICIALIZAMOS LOS NUEVOS CAMPOS
    restaurantAddress: null,
    restaurantPhone: null,
    categories: [],
    combos: [],
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));

        const [data, restInfo] = await Promise.all([
          fetchMenuPublic(restaurantId).catch(() => null),
          fetchRestaurant(restaurantId, { credentials: "include" }).catch(
            () => null
          ),
        ]);

        const categories =
          data?.categories ||
          data?.categorias ||
          [];

        const combos = data?.combos || [];

        const restaurantName =
          data?.restaurantName ||
          data?.restaurant?.nombre ||
          data?.restaurante?.nombre ||
          restInfo?.nombre ||
          "Restaurante";

        const billingMode = String(
          data?.billingMode ||
            data?.restaurante?.billing_mode ||
            restInfo?.billing_mode ||
            "none"
        ).toLowerCase();

        const rawCover =
          data?.restaurantCoverUrl ||
          data?.restaurant?.cover_url ||
          data?.restaurante?.cover_url ||
          restInfo?.cover_url ||
          null;

        const restaurantCoverUrl = rawCover ? toAbs(rawCover) : null;

        // 👇 2. EXTRAEMOS DIRECCIÓN Y TELÉFONO (Según tu tabla DB)
        // Buscamos en 'restInfo' (fetchRestaurant) o en 'data.restaurante'
        const restaurantAddress = 
          restInfo?.direccion || 
          data?.restaurante?.direccion || 
          data?.restaurant?.address || 
          null;

        const restaurantPhone = 
          restInfo?.telefono || 
          data?.restaurante?.telefono || 
          data?.restaurant?.phone || 
          null;

        if (!alive) return;

        setState({
          loading: false,
          error: "",
          categories,
          combos,
          restaurantName,
          billingMode,
          restaurantCoverUrl,
          // 👇 3. GUARDAMOS EN EL ESTADO
          restaurantAddress,
          restaurantPhone,
        });
      } catch (e) {
        if (!alive) return;
        setState((s) => ({
          ...s,
          loading: false,
          error: "No se pudo cargar el menú.",
        }));
      }
    })();

    return () => {
      alive = false;
    };
  }, [restaurantId]);

  const menuAll = useMemo(() => {
    const out = [];
    for (const c of state.categories || []) {
      const arr = Array.isArray(c?.items) ? c.items : [];
      for (const m of arr) {
        out.push({ ...m, categoria_id: m?.categoria_id ?? c?.id ?? null });
      }
    }
    return out;
  }, [state.categories]);

  const value = useMemo(
    () => ({
      apiBase: API_BASE,
      restaurantId,
      mesaId,
      mesaCode,
      restaurantName: state.restaurantName,
      billingMode: state.billingMode,
      restaurantCoverUrl: state.restaurantCoverUrl,
      
      // 👇 4. EXPONEMOS AL CONTEXTO PÚBLICO
      restaurantAddress: state.restaurantAddress,
      restaurantPhone: state.restaurantPhone,

      categories: state.categories,
      combos: state.combos,

      menuAll,
      menu: menuAll,
      items: menuAll,
      fullMenu: menuAll,
      allMenu: menuAll,
      menuItems: menuAll,

      loading: state.loading,
      error: state.error,
    }),
    [
      restaurantId,
      mesaId,
      mesaCode,
      state.restaurantName,
      state.billingMode,
      state.restaurantCoverUrl,
      // 👇 AGREGAMOS DEPENDENCIAS PARA QUE SE ACTUALICE SI CAMBIAN
      state.restaurantAddress,
      state.restaurantPhone,
      
      state.categories,
      state.combos,
      state.loading,
      state.error,
      menuAll,
    ]
  );

  return (
    <MenuPublicCtx.Provider value={value}>
      {children}
    </MenuPublicCtx.Provider>
  );
}