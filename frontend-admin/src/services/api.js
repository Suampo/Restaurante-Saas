  // src/services/api.js (front PÚBLICO)
  import axios from "axios";

  const API_BASE =
    import.meta.env.VITE_API_PEDIDOS ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:4000";

  // Config pública para el checkout (Culqi/Yape) — NO requiere login
  export async function apiGetPublicConfig(restaurantId) {
    const { data } = await axios.get(
      `${API_BASE}/api/pay/public/${restaurantId}/config`
    );
    return data;
  }

  // Preparar orden pública (metadatos: mesa, comprobante, etc.)
  export async function apiPreparePublicOrder(restaurantId, payload) {
    const { data } = await axios.post(
      `${API_BASE}/api/pay/public/${restaurantId}/checkout/prepare`,
      payload
    );
    return data;
  }

  // Cobrar con token (Tarjeta/Yape) público
  export async function apiChargePublicToken(restaurantId, payload) {
    const { data } = await axios.post(
      `${API_BASE}/api/pay/public/${restaurantId}/checkout/charge`,
      payload
    );
    return data;
  }

  // Menú público (coincide con tu router public.menu.js montado en /api)
  export async function apiGetPublicMenu(restaurantId) {
    const { data } = await axios.get(
      `${API_BASE}/api/public/menu`,
      { params: { restaurantId } }
    );
    return data;
  }
