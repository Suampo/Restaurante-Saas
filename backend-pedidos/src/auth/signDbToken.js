import { SignJWT } from 'jose';
const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

export async function signDbToken({ email, restaurantId, ttlSec = 3600 }) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    role: 'authenticated',
    email,
    restaurant_id: restaurantId
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec) // 1 hora
    .sign(secret);
}
