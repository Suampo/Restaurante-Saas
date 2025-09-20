// src/services/restaurantApi.js
const API =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const cache = new Map();

/** Devuelve solo el nombre del restaurante (con caché in-memory) */
export async function fetchRestaurantName(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return "";
  const key = `name:${id}`;
  if (cache.has(key)) return cache.get(key);

  const res = await fetch(`${API}/public/restaurants/${id}`, opt);
  if (!res.ok) throw new Error("No se pudo cargar el restaurante");
  const data = await res.json();
  const name = data?.nombre ?? "";
  cache.set(key, name);
  return name;
}

/** Config pública opcional: si no existe el endpoint, devuelve null sin romper */
export async function fetchRestaurantSettings(restaurantId, opt = {}) {
  const id = Number(restaurantId || 0);
  if (!id) return null;
  const key = `settings:${id}`;
  if (cache.has(key)) return cache.get(key);

  const url = `${API}/public/restaurants/${id}/settings`;
  try {
    const res = await fetch(url, opt);
    if (!res.ok) return null;
    const data = await res.json();
    cache.set(key, data);
    return data;
  } catch {
    return null;
  }
}
