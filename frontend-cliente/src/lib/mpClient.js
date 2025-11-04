// src/lib/mpClient.js
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { getMPPublicKey } from "../services/mercadopago";

/**
 * Inicializa Mercado Pago (React SDK) una sola vez por restaurante
 * y devuelve las referencias a los componentes que usaremos.
 */
export async function getMP(restaurantId) {
  if (typeof window === "undefined") return null;

  // Reutiliza instancia ya creada para el mismo restaurante
  if (window.__MP_INSTANCE && window.__MP_PK_FOR === String(restaurantId)) {
    return window.__MP_INSTANCE;
  }

  // Pide la PUBLIC KEY (pk_test... / pk_prod...)
  const publicKey = await getMPPublicKey(restaurantId);
  if (!publicKey) throw new Error("No se pudo obtener la Public Key de Mercado Pago");

  // Solo re-inicializa si cambió la key
  if (window.__MP_INIT_KEY !== publicKey) {
    initMercadoPago(publicKey, { locale: "es-PE" });
    window.__MP_INIT_KEY = publicKey;
  }

  const mod = { CardPayment };
  window.__MP_INSTANCE = mod;
  window.__MP_PK_FOR = String(restaurantId);
  return mod;
}
