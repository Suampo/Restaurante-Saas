// src/auth/signDbToken.js
import { SignJWT } from "jose";

const secret = new TextEncoder().encode(
  process.env.SUPABASE_JWT_SECRET || "dev_admin_secret"
);

/**
 * Firma un token para el frontend/Supabase.
 * Mantiene role="authenticated" (requerido por Supabase) y añade claims de app:
 *  - rol / app_role : 'admin' | 'owner' | 'staff'
 *  - user_id / uid  : id numérico/uuid del usuario
 *  - restaurant_id  : id del restaurante
 */
export async function signDbToken({
  email,
  restaurantId,
  role: appRole = "admin",
  userId = null,
  ttlSec = 3600,
}) {
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    // ==== Requeridos por Supabase ====
    aud: "authenticated",
    role: "authenticated",

    // ==== Identidad principal ====
    sub: userId ? String(userId) : (email || `admin@${restaurantId}.local`),
    email: email || null,

    // ==== Claims de negocio (para tu app) ====
    rol: appRole,               // <- úsalo en el front (preferido)
    app_role: appRole,          // alias por compatibilidad
    user_id: userId || null,
    uid: userId || null,
    restaurantId,
    restaurant_id: restaurantId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .sign(secret);
}

export default signDbToken;
  