// src/services/api.js

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";       // backend-pedidos
const FACT_API = import.meta.env.VITE_FACT_API_URL || "http://localhost:5000"; // backend-facturación

const authHeader = () => {
  const t = localStorage.getItem("client_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// --- helpers base=API ---
async function get(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function post(path, body, withAuth = false) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(withAuth ? authHeader() : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// --- helpers base=FACT_API ---
async function factGet(path) {
  const res = await fetch(`${FACT_API}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function factPost(path, body, withAuth = false) {
  const res = await fetch(`${FACT_API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(withAuth ? authHeader() : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* =========================
   PRIVADO (ya los tenías)
   ========================= */

/**
 * Crea el pedido y guarda billing_client en la DB (backend-facturación :5000).
 * Params:
 * {
 *   mesaId?, restaurantId?,
 *   items?: [{ menu_item_id?, combo_id?, cantidad, precio_unitario }],
 *   idempotencyKey?,
 *   total?,                                // opcional; si no, se calcula desde items
 *   comprobanteTipo: "01"|"03",            // Factura | Boleta
 *   billingClient: { ... },                // JSON canónico
 *   billingEmail?                          // si no, toma billingClient.email
 * }
 * Returns: { pedidoId, amount (céntimos), currency: "PEN" }
 */
export const apiCreatePedido = ({
  mesaId,
  restaurantId,
  items,
  idempotencyKey,
  total,
  comprobanteTipo,
  billingClient,
  billingEmail
}) => factPost(
  `/api/pedidos`,
  { mesaId, restaurantId, items, idempotencyKey, total, comprobanteTipo, billingClient, billingEmail },
  true
);

// Alias para compatibilidad con tu código existente
export const apiCrearPedido = apiCreatePedido;

/* (Si aún usas estos privados en :4000, los dejo tal cual.
   Para Culqi público usaremos los de más abajo en :5000) */
export const apiCulqiOrder  = ({ amount, email, description, metadata, paymentMethods }) =>
  post(`/api/pay/culqi/order`, { amount, email, description, metadata, paymentMethods }, true);

export const apiCulqiCharge = ({ amount, email, tokenId, description, metadata }) =>
  post(`/api/pay/culqi/charge`, { amount, email, tokenId, description, metadata }, true);

/* Dev (en :4000) */
export const simularPago = (pedidoId) => post(`/api/dev/simular-pago`, { pedidoId });

/* ======================================
   PÚBLICO (BYO keys) → backend :5000
   ====================================== */

/** Obtiene la Culqi public key y/o nombre del restaurante.
 *  Intenta primero en :5000; si no existe, cae a :4000.
 */
export const apiGetPublicConfig = async (restaurantId) => {
  try {
    return await factGet(`/api/pay/public/${restaurantId}/config`);
  } catch {
    return await get(`/api/pay/public/${restaurantId}/config`);
  }
};

/** Prepara una ORDER en Culqi (pasa metadata con orderId/restaurantId/comprobanteTipo) */
export const apiPreparePublicOrder = (_restaurantId, payload) =>
  // en el backend-facturación montamos /psp/culqi/orders
  factPost(`/psp/culqi/orders`, payload);

/** Crea un CHARGE clásico en Culqi (token + metadata) */
export const apiChargePublicToken = (_restaurantId, payload) =>
  // en el backend-facturación montamos /psp/culqi/charges
  factPost(`/psp/culqi/charges`, payload);
