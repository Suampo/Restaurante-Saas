// src/lib/mpClient.js
import { initMercadoPago, Payment, CardPayment } from "@mercadopago/sdk-react";
import { getMPPublicKey } from "../services/mercadopago";

export async function getMP(restaurantId) {
  if (typeof window === "undefined") return null;

  if (window.__MP_INSTANCE && window.__MP_PK_FOR === String(restaurantId)) {
    return window.__MP_INSTANCE;
  }

  const publicKey = await getMPPublicKey(restaurantId);

  if (!window.__MP_INIT_KEY || window.__MP_INIT_KEY !== publicKey) {
    initMercadoPago(publicKey, { locale: "es-PE" });
    window.__MP_INIT_KEY = publicKey;
  }

  const mod = { Payment, CardPayment };
  window.__MP_INSTANCE = mod;
  window.__MP_PK_FOR = String(restaurantId);
  return mod;
}
