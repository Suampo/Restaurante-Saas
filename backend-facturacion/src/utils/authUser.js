// Utilidad para extraer el usuario (auth.users) desde el token del request
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
// Preferimos ANON si existe; si no, usamos SERVICE_ROLE_KEY del .env de facturación
const SUPABASE_ANON_OR_SERVICE =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabaseForUser(req) {
  const auth = req.headers.authorization || "";
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_OR_SERVICE, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return sb;
}

async function getAuthUser(req) {
  try {
    const supabaseUser = getSupabaseForUser(req);
    const { data, error } = await supabaseUser.auth.getUser();
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

module.exports = { getAuthUser };
