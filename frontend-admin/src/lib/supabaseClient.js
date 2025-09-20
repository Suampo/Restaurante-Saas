import { createClient } from '@supabase/supabase-js';

export function makeSupabaseClient(dbToken) {
  return createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    { global: { headers: { Authorization: `Bearer ${dbToken}` } } }
  );
}
