// src/services/restaurantApi.js
const API =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

// Backend de facturación (tu .env usa VITE_FACT_API_URL)
const FACT_API =
  import.meta.env.VITE_FACT_API_URL ||
  import.meta.env.VITE_API_FACTURACION || // compat
  API;

const cache = new Map();

async function safeJson(res) {
  try { return await res.json(); } catch { return null; }
}

/** Fetch tolerante: no lanza en 4xx/5xx, devuelve null */
async function tryFetchJson(url, opt = {}) {
  try {
    const res = await fetch(url, { credentials: "include", ...opt });
    if (!res.ok) return null;
    return await safeJson(res);
  } catch {
    return null;
  }
}

/**
 * Devuelve { id, nombre, billing_mode } probando varias rutas.
 * Cachea el resultado en memoria.
 */
export async function fetchRestaurant(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return null;
  const key = `rest:${id}`;
  if (cache.has(key)) return cache.get(key);

  // 1) backend-pedidos con prefijo /api (correcto según tu server)
  let data =
    await tryFetchJson(`${API}/api/public/restaurants/${id}`, opt) ||
    // 2) fallback sin /api (por si cambias el montaje)
    await tryFetchJson(`${API}/public/restaurants/${id}`, opt);

  // 3) fallback a backend-facturación: /api/pay/public/:id/config
  //    Mapear { name, billingMode } -> { nombre, billing_mode }
  if (!data) {
    const cfg = await tryFetchJson(`${FACT_API}/api/pay/public/${id}/config`, opt);
    if (cfg && (cfg.name || cfg.billingMode)) {
      data = {
        id,
        nombre: cfg.name || "Restaurante",
        billing_mode: (cfg.billingMode || "none").toLowerCase(),
      };
    }
  }

  if (!data) return null;
  cache.set(key, data);
  return data; // { id, nombre, billing_mode }
}

/** Devuelve solo el nombre del restaurante (cacheado) */
export async function fetchRestaurantName(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return "";
  const key = `name:${id}`;
  if (cache.has(key)) return cache.get(key);

  const rest = await fetchRestaurant(id, opt);
  const name = rest?.nombre ?? "";
  cache.set(key, name);
  return name;
}

/** Config pública (si existe). Tolerante a prefijo /api y a FACT_API. */
export async function fetchRestaurantSettings(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return null;
  const key = `settings:${id}`;
  if (cache.has(key)) return cache.get(key);

  const data =
    // primero en pedidos con /api
    (await tryFetchJson(`${API}/api/public/restaurants/${id}/settings`, opt)) ||
    // sin /api por si cambias montaje
    (await tryFetchJson(`${API}/public/restaurants/${id}/settings`, opt)) ||
    // fallback en facturación (ahí sí existe /public/.../settings)
    (await tryFetchJson(`${FACT_API}/public/restaurants/${id}/settings`, opt));

  if (!data) return null;
  cache.set(key, data);
  return data;
}

/** Menú público V2 (combos con grupos e items) – tolerante a prefijo /api */
export async function fetchMenuV2(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return { combos: [] };

  let res =
    (await tryFetchJson(`${API}/api/public/menu-v2?restaurantId=${id}`, opt)) ||
    (await tryFetchJson(`${API}/public/menu-v2?restaurantId=${id}`, opt));

  return res || { combos: [] };
}
