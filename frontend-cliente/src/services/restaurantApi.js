// src/services/restaurantApi.js
const API = import.meta.env.VITE_API_URL;
const cache = new Map();

export async function fetchRestaurantName(restaurantId, opt = {}) {
  if (!restaurantId) return "";
  const key = `name:${restaurantId}`;
  if (cache.has(key)) return cache.get(key);

  const url = `${API}/public/restaurants/${restaurantId}`;
  const res = await fetch(url, opt);
  if (!res.ok) throw new Error("No se pudo cargar el restaurante");
  const data = await res.json();
  const name = data?.nombre ?? "";
  cache.set(key, name);
  return name;
}

export async function fetchRestaurantSettings(restaurantId, opt = {}) {
  if (!restaurantId) return null;
  const key = `settings:${restaurantId}`;
  if (cache.has(key)) return cache.get(key);

  const url = `${API}/public/restaurants/${restaurantId}/settings`;
  const res = await fetch(url, opt);
  if (!res.ok) return null;
  const data = await res.json();
  cache.set(key, data);
  return data;
}
