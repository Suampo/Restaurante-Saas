// src/services/culqi.js
import {
  apiGetPublicConfig,
  apiPreparePublicOrder,   // debe enviar body con { amount, currency, email, description, paymentMethods?, metadata }
  apiChargePublicToken,    // debe enviar body con { amount, currency, email, tokenId, description, metadata }
  apiCreatePedido,         // << añadiremos esto en src/services/api.js (abajo)
} from "./api";

/** Carga diferida de Culqi (una sola vez) */
let culqiLoading = null;
export function ensureCulqi() {
  if (window.CulqiCheckout) return Promise.resolve();
  if (culqiLoading) return culqiLoading;
  culqiLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://js.culqi.com/checkout-js";
    s.async = true;
    s.onload = () =>
      window.CulqiCheckout
        ? resolve()
        : reject(new Error("Culqi loaded but CulqiCheckout not found"));
    s.onerror = () => reject(new Error("No se pudo cargar Culqi"));
    document.head.appendChild(s);
  });
  return culqiLoading;
}

/** Construye la instancia del checkout (requiere Culqi cargado) */
function buildCulqiInstance(publicKey, {
  title,
  currency,
  amount,
  order,   // opcional
  email,   // opcional (prefill)
}) {
  if (!window.CulqiCheckout) {
    throw new Error("CulqiCheckout no está disponible.");
  }
  const settings = { title, currency, amount, ...(order ? { order } : {}) };
  const client   = email ? { email } : {};
  const options  = {
    lang: "es",
    installments: true,
    modal: true,
    paymentMethods: order
      ? { tarjeta: true, yape: true, bancaMovil: true }
      : { tarjeta: true },
  };
  return new window.CulqiCheckout(publicKey, { settings, client, options });
}

/**
 * Flujo recomendado: crea el pedido (guarda billing_client) y luego abre Culqi.
 * - payloadPedido: { restaurantId, items?, total?, comprobanteTipo, billingClient, billingEmail }
 * - Si no mandas "total", tu backend puede calcularlo desde "items".
 */
export async function startPublicCheckoutCulqi({ payloadPedido, description = "Pedido" }) {
  const { restaurantId, billingEmail } = payloadPedido || {};
  if (!restaurantId) throw new Error("payloadPedido.restaurantId requerido");

  // 1) Crear pedido en backend (guarda billing_client en pedidos.billing_client)
  const { pedidoId, amount, currency } = await apiCreatePedido(payloadPedido); // amount en céntimos

  // 2) Abrir Culqi con metadata completa (orderId, restaurantId, comprobanteTipo)
  const customer = { email: billingEmail || payloadPedido?.billingClient?.email };
  return openPublicCheckoutCulqi({
    restaurantId,
    pedidoId,
    amount,
    currency,
    customer,
    metadataExtra: {},                  // por si quieres agregar mesaId, etc.
    comprobanteTipo: payloadPedido.comprobanteTipo, // "01" | "03"
    description
  });
}

/**
 * Abre Culqi:
 * - Primero intenta ORDER (Yape/billeteras).
 * - Si falla, cae a token+charge clásico.
 * Requiere "pedidoId" para armar metadata correcta.
 */
export async function openPublicCheckoutCulqi({
  restaurantId,
  pedidoId,
  amount,                 // céntimos (integer)
  customer,               // { email, fullName?, phone? }
  comprobanteTipo,        // "01" | "03"
  metadataExtra = {},     // cualquier metadato adicional (mesaId, etc.)
  currency = "PEN",
  description = "Pedido",
}) {
  if (!restaurantId) throw new Error("Falta restaurantId");
  if (!pedidoId) throw new Error("Falta pedidoId");
  if (!amount || !customer?.email) throw new Error("Faltan monto/email");

  // 1) Obtener publicKey del restaurante
  const cfg = await apiGetPublicConfig(restaurantId); // { culqiPublicKey, name }
  const publicKey = cfg.culqiPublicKey;

  // Metadata obligatoria para el webhook
  const metadata = {
    orderId: String(pedidoId),
    restaurantId: String(restaurantId),
    comprobanteTipo: String(comprobanteTipo || "03"), // default Boleta
    ...metadataExtra,
  };

  // 2) Intentar ORDER (activa Yape/billeteras)
  try {
    const data = await apiPreparePublicOrder(restaurantId, {
      amount,
      currency,
      email: customer.email,
      description,
      paymentMethods: { tarjeta: true, yape: true, bancaMovil: true },
      metadata, // <<<<<<<<<<<<<<<<<<<<<< AQUI VA
    });

    if (data?.culqi?.orderId) {
      await ensureCulqi();
      const inst = buildCulqiInstance(publicKey, {
        title: cfg.name || "Pago",
        currency,
        amount,
        order: data.culqi.orderId,
        email: customer.email,
      });

      return new Promise((resolve, reject) => {
        inst.culqi = function () {
          if (inst.order) {
            resolve({ mode: "order", order: inst.order });
            alert("Procesando pago… gracias por tu pedido.");
          } else if (inst.error) {
            reject(inst.error);
            alert(inst.error?.user_message || "Error en el pago");
          }
        };
        inst.open();
      });
    }

    if (data?.paymentUrl) {
      location.href = data.paymentUrl;
      return;
    }

    // Fallback a token
    return tokenFallback({
      publicKey, restaurantId, pedidoId, amount, currency, customer, metadata, description,
    });
  } catch (err) {
    console.warn("[Orders] no disponible → token+charge:", err?.message || err);
    return tokenFallback({
      publicKey, restaurantId, pedidoId, amount, currency, customer, metadata, description,
    });
  }
}

function tokenFallback({
  publicKey,
  restaurantId,
  pedidoId,
  amount,
  currency,
  customer,
  metadata,
  description,
}) {
  return (async () => {
    await ensureCulqi();
    const inst = buildCulqiInstance(publicKey, {
      title: "Pago",
      currency,
      amount,
      email: customer.email,
    });

    return new Promise((resolve, reject) => {
      inst.culqi = async function () {
        try {
          if (inst.token) {
            const tokenId = inst.token.id;
            const out = await apiChargePublicToken(restaurantId, {
              amount,
              currency,
              email: customer.email,
              tokenId,
              description,
              metadata: { ...metadata, flow: "token+charge" } // <<<< también pasa metadata aquí
            });
            resolve({ mode: "token+charge", result: out });
            alert("Pago en proceso. ¡Gracias!");
          } else if (inst.error) {
            reject(inst.error);
            alert(inst.error?.user_message || "No se pudo procesar el pago");
          }
        } catch (e) {
          reject(e);
          alert("No se pudo completar el pago.");
        }
      };
      inst.open();
    });
  })();
}

// Alias opcional
export { openPublicCheckoutCulqi as openCulqiCheckout };
