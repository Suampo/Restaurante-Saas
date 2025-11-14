// backend-pasarela/src/services/supabase.js
import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL || // por si acaso
  "";

const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.SUPABASE_ANON_KEY ||
  "";

if (!url || !key) {
  console.error(
    "[supabase] Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY en el .env de la PASARELA"
  );
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export default supabase;
