// src/context/AuthProvider.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/* ========= utils ========= */
const getCookie = (k) => document.cookie.split('; ').find(c => c.startsWith(k+'='))?.split('=')[1];
const parseJwt = (t) => { try { return JSON.parse(atob(String(t).split('.')[1])); } catch { return {}; } };

async function ensureCsrf() {
  // siembra cookie csrf si falta
  if (!getCookie('csrf_token')) {
    try { await fetch('/api/csrf', { credentials: 'include' }); } catch {}
  }
}

/* ========= contexto ========= */
const AuthCtx = createContext(null);

/**
 * Mantiene **un solo** cliente de Supabase y solo actualiza los headers
 * para evitar el warning "Multiple GoTrueClient instances...".
 */
export function AuthProvider({ children }) {
  // hidrata token desde sessionStorage (evita parpadeos en rutas protegidas)
  const initialToken = typeof window !== 'undefined' ? sessionStorage.getItem('dbToken') : null;
  const [dbToken, setDbToken] = useState(initialToken);

  // único cliente (ref), más un estado "expuesto" para pasar por contexto
  const supabaseRef = useRef(null);
  const [supabase, setSupabase] = useState(null);

  const refreshTimer = useRef(null);

  // crea/actualiza el cliente sin producir instancias nuevas
  const makeOrUpdateClient = (token) => {
    if (!token) {
      supabaseRef.current = null;
      setSupabase(null);
      return null;
    }
    if (!supabaseRef.current) {
      supabaseRef.current = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          auth: { persistSession: false }, // sin storage => no colisiona
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
      setSupabase(supabaseRef.current);
    } else {
      // Actualiza headers del cliente existente (sin recrear)
      const client = supabaseRef.current;
      try { client.rest?.setAuth?.(token); } catch {}
      client.headers = { ...(client.headers || {}), Authorization: `Bearer ${token}` };
      setSupabase(client);
    }
    return supabaseRef.current;
  };

  // programa el refresh antes del exp
  const scheduleRefresh = (token) => {
    clearTimeout(refreshTimer.current);
    const { exp } = parseJwt(token);
    if (!exp) return;
    const msUntilExp = exp * 1000 - Date.now();
    // refresca 5 min antes, mínimo 30s
    const when = Math.max(30_000, msUntilExp - 5 * 60_000);
    refreshTimer.current = setTimeout(refreshDbToken, when);
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
    const res = await fetch('/api/session/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.dbToken) throw new Error(json?.error || 'Login falló');

    // guarda token RLS
    setToken(json.dbToken);

    // siembra cookie httpOnly para poder refrescar luego
    try {
      await fetch('/api/auth/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({ token: json.dbToken }),
      });
    } catch {}
    return json;
  };

  const refreshDbToken = async () => {
    try {
      await ensureCsrf();
      const csrf = getCookie('csrf_token');
      const res = await fetch('/api/session/refresh', {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'x-csrf-token': csrf } : {},
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.dbToken) {
        setToken(json.dbToken);
      }
    } catch {
      // si falla, no hacemos nada aquí; las llamadas API reintentan y redirigen si toca
    }
  };

  const logout = async () => {
    clearTimeout(refreshTimer.current);
    sessionStorage.removeItem('dbToken');
    setDbToken(null);
    supabaseRef.current = null;
    setSupabase(null);
    try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }); } catch {}
  };

  useEffect(() => {
    // al montar: si había token inicial, configura cliente y refresh
    if (initialToken) {
      makeOrUpdateClient(initialToken);
      scheduleRefresh(initialToken);
    }
    return () => clearTimeout(refreshTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(
    () => ({ dbToken, supabase, login, refreshDbToken, logout }),
    [dbToken, supabase]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
