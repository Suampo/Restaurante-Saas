// src/context/AuthProvider.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ========= utils ========= */
const getCookie = (k) =>
  document.cookie.split('; ').find(c => c.startsWith(k + '='))?.split('=')[1];
const parseJwt = (t) => { try { return JSON.parse(atob(String(t).split('.')[1])); } catch { return {}; } };

async function ensureCsrf() {
  if (!getCookie('csrf_token')) {
    try { await fetch('/api/csrf', { credentials: 'include' }); } catch {}
  }
}

/* ========= contexto ========= */
const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const initialToken = typeof window !== 'undefined' ? sessionStorage.getItem('dbToken') : null;
  const [dbToken, setDbToken] = useState(initialToken);
  const [ready, setReady] = useState(false);

  const supabaseRef = useRef(null);
  const [supabase, setSupabase] = useState(null);
  const refreshTimer = useRef(null);

  // === Derivar claims útiles del token ===
  const claims = useMemo(() => (dbToken ? parseJwt(dbToken) : {}), [dbToken]);

  // ⚠️ IMPORTANTE: preferir app_role/rol (NO usar claims.role porque es "authenticated" de Supabase)
  const role = useMemo(() => {
    const r = claims.app_role || claims.rol;
    return r ? String(r).toLowerCase() : null;
  }, [claims]);

  const restaurantId = claims.restaurant_id ?? claims.restaurantId ?? null;
  const userId = claims.sub || claims.user_id || claims.uid || null;
  const email = claims.email || null;

  const makeOrUpdateClient = (token) => {
    if (!token) { supabaseRef.current = null; setSupabase(null); return null; }
    if (!supabaseRef.current) {
      supabaseRef.current = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession:false }, global: { headers:{ Authorization:`Bearer ${token}` } } }
      );
      setSupabase(supabaseRef.current);
    } else {
      const c = supabaseRef.current;
      try { c.rest?.setAuth?.(token); } catch {}
      c.headers = { ...(c.headers||{}), Authorization:`Bearer ${token}` };
      setSupabase(c);
    }
    return supabaseRef.current;
  };

  const scheduleRefresh = (token) => {
    clearTimeout(refreshTimer.current);
    const { exp } = parseJwt(token);
    if (!exp) return;
    const when = Math.max(30_000, exp*1000 - Date.now() - 5*60_000);
    refreshTimer.current = setTimeout(() => { refreshDbToken().catch(()=>{}); }, when);
  };

  const setToken = (token) => {
    setDbToken(token);
    sessionStorage.setItem('dbToken', token);
    makeOrUpdateClient(token);
    scheduleRefresh(token);
  };

  const login = async (email, password) => {
    await ensureCsrf();
    const csrf = getCookie('csrf_token');

    // 1) login → dbToken
    const res = await fetch('/api/session/login', {
      method:'POST', credentials:'include',
      headers:{ 'Content-Type':'application/json', ...(csrf?{ 'x-csrf-token':csrf }:{}) },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json().catch(()=>({}));
    if (!res.ok || !json?.dbToken) throw new Error(json?.error || 'Login falló');

    setToken(json.dbToken);

    // 2) siembra cookie httpOnly (admin_session) desde el mismo dbToken
    try {
      await fetch('/api/auth/session', {
        method:'POST', credentials:'include',
        headers:{ 'Content-Type':'application/json', ...(csrf?{ 'x-csrf-token':csrf }:{}) },
        body: JSON.stringify({ token: json.dbToken })
      });
    } catch {}

    return json;
  };

  const refreshDbToken = async ({ signal } = {}) => {
    try {
      await ensureCsrf();
      const csrf = getCookie('csrf_token');
      const r = await fetch('/api/session/refresh', {
        method:'POST', credentials:'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
        signal
      });
      if (r.status === 401) return false; // no hay cookie de sesión
      const j = await r.json().catch(()=>({}));
      if (r.ok && j?.dbToken) { setToken(j.dbToken); return true; }
      return false;
    } catch { return false; }
  };

  const logout = async () => {
    // limpiar estado local primero
    clearTimeout(refreshTimer.current);
    sessionStorage.removeItem('dbToken');
    localStorage.removeItem('persist');
    setDbToken(null);
    supabaseRef.current = null;
    setSupabase(null);
    // cerrar cookie httpOnly con CSRF
    try {
      await ensureCsrf();
      const csrf = getCookie('csrf_token');
      await fetch('/api/auth/logout', {
        method:'POST',
        credentials:'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {}
      });
    } catch {}
  };

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        if (initialToken) {
          setToken(initialToken);
        } else {
          await refreshDbToken({ signal: ctrl.signal });
        }
      } finally {
        setReady(true);
      }
    })();
    return () => { clearTimeout(refreshTimer.current); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ dbToken, supabase, login, refreshDbToken, logout, ready, role, restaurantId, userId, email }),
    [dbToken, supabase, ready, role, restaurantId, userId, email]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
