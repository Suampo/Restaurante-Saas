// backend-pasarela/src/services/mpKeys.js
import { supabase } from "./supabase.js";

/**
 * Obtiene credenciales de MP para un restaurante desde Supabase.
 * 1) Busca en public.psp_credentials (provider='mercadopago', active=true)
 * 2) Si no hay, intenta fallback a public.restaurantes (public_key / secret_key)
 * Devuelve siempre { publicKey, accessToken } con null si no existe.
 */
export async function getMpKeysForRestaurant(restaurantId) {
  const rid = Number(restaurantId || 0);
  if (!rid) return { publicKey: null, accessToken: null };

  // 1) psp_credentials (preferido)
  const { data: cred, error: errCred } = await supabase
    .from("psp_credentials")
    .select("public_key, secret_key")
    .eq("restaurant_id", rid)
    .eq("provider", "mercadopago")
    .eq("active", true)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (errCred) throw errCred;

  if (cred && (cred.public_key || cred.secret_key)) {
    return {
      publicKey: (cred.public_key || "").trim() || null,
      accessToken: (cred.secret_key || "").trim() || null,
    };
  }

  // 2) Fallback: tabla restaurantes (por compatibilidad)
  const { data: rest, error: errRest } = await supabase
    .from("restaurantes")
    .select("public_key, secret_key")
    .eq("id", rid)
    .limit(1)
    .maybeSingle();

  if (errRest) throw errRest;

  return {
    publicKey: (rest?.public_key || "").trim() || null,
    accessToken: (rest?.secret_key || "").trim() || null,
  };
}

/** Fallbacks del .env cuando no hay credenciales en DB */
export function getEnvMpPublicKey() {
  return (process.env.MP_PUBLIC_KEY || "").trim() || null;
}
export function getEnvMpAccessToken() {
  return (process.env.MP_ACCESS_TOKEN || "").trim() || null;
}
