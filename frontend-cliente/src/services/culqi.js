// src/services/culqi.js
import {
  apiGetPublicConfig,
  apiPreparePublicOrder,   // POST :5000/psp/culqi/orders  -> { id, ... } (puede fallar si no estás habilitado)
  apiChargePublicToken,    // POST :5000/psp/culqi/charges
  apiCreatePedido,         // POST :5000/api/pedidos
} from "./api.js";

/* =========================
   LOADERS
   ========================= */

// 1) Culqi Custom (https://js.culqi.com/checkout-js)
let customLoading = null;
function ensureCulqiCustom () {
  if (window.CulqiCheckout) return Promise.resolve();
  if (customLoading) return customLoading;
  customLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.culqi.com/checkout-js";
    s.async = true;
    s.onload = () => window.CulqiCheckout ? resolve() : reject(new Error("Culqi Custom no disponible"));
    s.onerror = () => reject(new Error("No se pudo cargar Culqi Custom"));
    document.head.appendChild(s);
  });
  return customLoading;
}

// 2) Culqi 3DS (https://3ds.culqi.com) → define window.Culqi3DS
let threeDSLoading = null;
function ensureCulqi3DS (publicKey) {
  if (window.Culqi3DS && window.Culqi3DS.publicKey) return Promise.resolve();
  if (threeDSLoading) return threeDSLoading;
  threeDSLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://3ds.culqi.com";
    s.defer = true;
    s.async = true;
    s.onload = () => {
      try {
        window.Culqi3DS = window.Culqi3DS || {};
        window.Culqi3DS.publicKey = publicKey;
        resolve();
      } catch (e) {
        reject(new Error("Culqi3DS cargó pero no expuso la API"));
      }
    };
    s.onerror = () => reject(new Error("No se pudo cargar Culqi3DS"));
    document.head.appendChild(s);
  });
  return threeDSLoading;
}

/* =========================
   HELPER: abrir Custom
   ========================= */
async function openCustom ({ publicKey, settings, client, options }) {
  await ensureCulqiCustom();
  await ensureCulqi3DS(publicKey); // <- evita “Culqi3DS is not defined”

  const inst = new window.CulqiCheckout(publicKey, { settings, client, options });

  return new Promise((resolve, reject) => {
    inst.culqi = function () {
      try {
        if (inst.token)  return resolve({ mode: "token",  token: inst.token });
        if (inst.order)  return resolve({ mode: "order",  order: inst.order });
        if (inst.error)  return reject(inst.error);
        return reject(new Error("Checkout cerrado sin token ni order"));
      } catch (e) { reject(e); }
    };
    inst.open();
  });
}

/* =========================
   FLUJOS ALTO NIVEL
   ========================= */
export async function startPublicCheckoutCulqi ({ payloadPedido, description = "Pedido" }) {
  const { restaurantId, billingEmail } = payloadPedido || {};
  if (!restaurantId) throw new Error("payloadPedido.restaurantId requerido");

  const { pedidoId, amount, currency } = await apiCreatePedido(payloadPedido); // céntimos
  const customer = { email: billingEmail || payloadPedido?.billingClient?.email };

  return openPublicCheckoutCulqi({
    restaurantId,
    pedidoId,
    amount,
    currency,
    customer,
    comprobanteTipo: payloadPedido.comprobanteTipo, // "01" | "03"
    description,
  });
}

export async function openPublicCheckoutCulqi ({
  restaurantId,
  pedidoId,
  amount,                 // céntimos
  customer,               // { email }
  comprobanteTipo,        // "01" | "03"
  metadataExtra = {},
  currency = "PEN",
  description = "Pedido",
}) {
  if (!restaurantId) throw new Error("Falta restaurantId");
  if (!pedidoId) throw new Error("Falta pedidoId");
  if (!amount || !customer?.email) throw new Error("Faltan monto/email");

  // 1) Config pública
  const cfg = await apiGetPublicConfig(restaurantId); // { culqiPublicKey, name? }
  const publicKey = cfg.culqiPublicKey;
  const title = cfg?.name || "Pago";

  // 2) Metadata para el webhook
  const metadata = {
    orderId: String(pedidoId),
    restaurantId: String(restaurantId),
    comprobanteTipo: String(comprobanteTipo || "03"),
    ...metadataExtra,
  };

  // 3) Intentar ORDER (Yape/billeteras). Si tu comercio no está habilitado, este POST devolverá 400 y seguiremos con tarjeta.
  let orderId = null;
  try {
    const ord = await apiPreparePublicOrder(restaurantId, {
      amount,
      currency,
      email: customer.email,
      description,
      metadata,
    });
    orderId = ord?.id || ord?.culqi?.id || ord?.orderId || null;
  } catch { /* comercio no habilitado para orders → continuamos sin order */ }

  // 4) Configurar Custom:
  const settings = {
    title,
    currency,
    amount: Number(amount) || 0,           // entero en céntimos
    ...(orderId ? { order: String(orderId) } : {}), // solo si existe
    // NO pongas xculqirsaid / rsapublickey si no tienes RSA habilitado oficialmente
  };

  const options = orderId ? {
    lang: "es",
    modal: true,
    installments: false, // evita llamadas a validate-iins (cuotas)
    paymentMethods: { tarjeta: true, yape: true, billetera: true, bancaMovil: true, agente: true, cuotealo: false },
    paymentMethodsSort: ["tarjeta","yape","billetera","bancaMovil","agente"],
  } : {
    lang: "es",
    modal: true,
    installments: false, // solo tarjeta
    paymentMethods: { tarjeta: true, yape: false, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
  };

  const client = { email: customer.email };

  // 5) Abrir checkout
  const result = await openCustom({ publicKey, settings, client, options });

  // 6) Si eligió ORDER, el webhook te avisará cuando quede pagado
  if (result.mode === "order") {
    return { ok: true, mode: "order", order: result.order };
  }

  // 7) Si eligió tarjeta (token) → crear cargo en tu backend público
  const out = await apiChargePublicToken(restaurantId, {
    amount, currency, email: customer.email,
    tokenId: result.token.id,
    description,
    metadata: { ...metadata, flow: "custom:token+charge" },
  });
  return { ok: true, mode: "token+charge", charge: out };
}

// Alias
export { openPublicCheckoutCulqi as openCulqiCheckout };
