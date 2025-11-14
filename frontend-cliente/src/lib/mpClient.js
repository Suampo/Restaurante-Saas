// src/lib/mpClient.js
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";
import { getMPPublicKey } from "../services/mercadopago";

/** Inicializa MP una sola vez por pestaña y reutiliza por restaurante */
export async function getMP(restaurantId) {
  if (typeof window === "undefined") return null;

  if (window.__MP_INSTANCE && window.__MP_PK_FOR === String(restaurantId)) {
    return window.__MP_INSTANCE;
  }

  const publicKey = await getMPPublicKey(restaurantId);
  if (!publicKey) throw new Error("No se pudo obtener la Public Key de Mercado Pago");

  // Solo una vez por ventana
  if (!window.__MP_ALREADY_INIT) {
    initMercadoPago(publicKey, { locale: "es-PE" });
    window.__MP_ALREADY_INIT = true;
    window.__MP_INIT_KEY = publicKey;
  } else if (window.__MP_INIT_KEY !== publicKey) {
    console.warn("[MP] Ya inicializado con otra publicKey; se reutiliza la existente.");
  }

  const mod = { CardPayment };
  window.__MP_INSTANCE = mod;
  window.__MP_PK_FOR = String(restaurantId);
  return mod;
}
