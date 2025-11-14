// src/utils/authUser.js
// Acepta tokens de Supabase O tu JWT local (emitido por :4000)

const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SB_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Secrets para verificar el JWT local (los mismos que usa :4000)
const LOCAL_SECRETS = [
  process.env.JWT_ADMIN_SECRET,
  process.env.JWT_SECRET,
  process.env.SUPABASE_JWT_SECRET, // por si lo usas también para firmar
].filter(Boolean);

function getBearer(req) {
  const h = req.headers?.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

function toRoles(x) {
  // normaliza distintas formas de roles en payload
  const r =
    x?.roles ??
    x?.role ??
    x?.app_metadata?.roles ??
    (x?.is_admin ? ["admin"] : []);
  if (Array.isArray(r)) return r;
  if (typeof r === "string") return [r];
  return [];
}

async function trySupabaseUser(accessToken) {
  if (!SUPABASE_URL || !SB_KEY || !accessToken) return null;
  try {
    const sb = createClient(SUPABASE_URL, SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // getUser(token) evita depender de headers globales
    const { data, error } = await sb.auth.getUser(accessToken);
    if (error || !data?.user) return null;
    const u = data.user;
    return { id: u.id, email: u.email, roles: toRoles(u) };
  } catch {
    return null;
  }
}

function tryLocalJwt(token) {
  for (const secret of LOCAL_SECRETS) {
    try {
      const p = jwt.verify(token, secret);
      return {
        id: p.sub || p.userId || p.id || p.uid,
        email: p.email,
        roles: toRoles(p),
      };
    } catch (_) {}
  }
  return null;
}

async function getAuthUser(req) {
  // 1) Authorization: Bearer ...
  const token = getBearer(req);
  let user = null;

  // Primero intentamos como token de Supabase
  if (token) user = await trySupabaseUser(token);

  // Si no es Supabase, probamos como JWT local (emitido por :4000)
  if (!user && token) user = tryLocalJwt(token);

  // 2) Fallback opcional por cookie (admin_session / mozo_session)
  if (!user && req.cookies) {
    for (const k of ["admin_session", "mozo_session", "session"]) {
      const c = req.cookies[k];
      if (!c) continue;
      const u = tryLocalJwt(c);
      if (u) {
        user = u;
        break;
      }
    }
  }

  return user; // null si no autenticado
}

module.exports = { getAuthUser };
