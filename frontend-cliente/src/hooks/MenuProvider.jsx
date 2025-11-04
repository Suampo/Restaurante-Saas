// src/hooks/MenuProvider.jsx
import React, { createContext, useEffect, useMemo, useState } from "react";
import { fetchRestaurant } from "../services/restaurantApi.js"; // <- añade esta import

// Si tienes helpers en /lib/ui, puedes usarlos; aquí sólo resolvemos API_BASE.
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

/**
 * Carga el menú público. Si en tu proyecto ya tienes funciones en
 * `services/restaurantApi`, puedes sustituir el fetch por esas funciones.
 */
async function fetchMenuPublic(restaurantId) {
  // Endpoint genérico: ajústalo si tu backend expone rutas diferentes.
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
    billingMode: "none", // 'sunat' | 'simple' | 'none'
    categories: [],
    combos: [],
  });

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: "" }));

        // Dispara ambas peticiones en paralelo:
        // - Menú público
        // - Info del restaurante (incluye billing_mode)
        const [data, restInfo] = await Promise.all([
          fetchMenuPublic(restaurantId).catch(() => null),
          fetchRestaurant(restaurantId, { credentials: "include" }).catch(() => null),
        ]);

        // Normalizamos respuesta del menú
        const categories =
          data?.categories ||
          data?.categorias ||
          [];

        const combos = data?.combos || [];

        // Nombre de restaurante: prioriza lo que venga, con fallbacks
        const restaurantName =
          data?.restaurantName ||
          data?.restaurant?.nombre ||
          data?.restaurante?.nombre ||
          restInfo?.nombre ||
          "Restaurante";

        // billingMode desde el menú o, si no viene, desde /public/restaurants/:id
        const billingMode = String(
          data?.billingMode ||
          data?.restaurante?.billing_mode ||
          restInfo?.billing_mode ||
          "none"
        ).toLowerCase();

        if (!alive) return;

        setState({
          loading: false,
          error: "",
          categories,
          combos,
          restaurantName,
          billingMode,
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

  // ====== Lista aplanada (menuAll) + alias de compatibilidad ======
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
      // meta
      apiBase: API_BASE,
      restaurantId,
      mesaId,
      mesaCode,
      restaurantName: state.restaurantName,
      billingMode: state.billingMode,

      // datos
      categories: state.categories,
      combos: state.combos,

      // aplanado y alias (para compatibilidad con componentes existentes)
      menuAll,           // recomendado usar este
      menu: menuAll,
      items: menuAll,
      fullMenu: menuAll,
      allMenu: menuAll,
      menuItems: menuAll,

      // ui state
      loading: state.loading,
      error: state.error,
    }),
    [
      restaurantId,
      mesaId,
      mesaCode,
      state.restaurantName,
      state.billingMode,
      state.categories,
      state.combos,
      state.loading,
      state.error,
      menuAll,
    ]
  );

  return <MenuPublicCtx.Provider value={value}>{children}</MenuPublicCtx.Provider>;
}
