// src/pages/Login.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";
import { setAuthIdentity } from "../services/cashApi";
import { CookingPot, Mail, Lock, Eye, EyeOff, Loader2, AlertTriangle, Keyboard } from "lucide-react";

const parseJwt = (t) => { try { return JSON.parse(atob(String(t).split(".")[1])); } catch { return {}; } };

function pickClaims(token, fallbackEmail) {
  const p = token ? parseJwt(token) : {};
  const role = String(p.rol || p.app_role || p.user_role || "").toLowerCase() || "admin";
  const rid  = p.restaurant_id ?? p.restaurantId ?? null;
  const uid  = p.sub || p.user_id || p.uid || null;
  const mail = p.email || fallbackEmail;
  return { role, rid, uid, mail };
}

export default function Login() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { login, refreshDbToken } = useAuth();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const navigated = useRef(false);
  const safeNavigate = (to) => {
    if (navigated.current) return;
    navigated.current = true;
    navigate(to, { replace: true });
  };

  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const ctrl = new AbortController();
    (async () => {
      try {
        const ok = await refreshDbToken({ signal: ctrl.signal });
        if (ok) {
          const to = loc.state?.from?.pathname || "/dashboard";
          safeNavigate(to);
          return;
        }
        sessionStorage.removeItem("dbToken");
      } catch {
        sessionStorage.removeItem("dbToken");
      } finally {
        setChecking(false);
      }
    })();
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loc.state, refreshDbToken]);

  const emailOk = email.trim() !== "";
  const passOk = password !== "";
  const canSubmit = emailOk && passOk && !loading;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setMsg("");
    try {
      setLoading(true);
      await login(email.trim(), password);

      if (remember) localStorage.setItem("persist", "1");
      else localStorage.removeItem("persist");

      const dbToken =
        sessionStorage.getItem("dbToken") ||
        localStorage.getItem("dbToken") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token");

      const { role, rid, uid, mail } = pickClaims(dbToken, email);

      // Headers para auditoría en endpoints de efectivo
      setAuthIdentity({ email: mail, id: uid, role, restaurantId: rid });

      const next = role === "staff"
        ? "/mozo/cobro-efectivo"
        : (loc.state?.from?.pathname || "/dashboard");

      safeNavigate(next);
    } catch (err) {
      console.error("[LOGIN] error:", err);
      setMsg(err?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
        <span className="sr-only">Verificando sesión…</span>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-zinc-50">
      <div className="pointer-events-none absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-green-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-green-400/20 blur-3xl" />

      <form onSubmit={handleLogin} className="relative z-10 w-full max-w-md rounded-3xl bg-white/80 p-6 shadow-xl ring-1 ring-black/5 backdrop-blur-md" aria-busy={loading}>
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 text-white shadow-lg shadow-green-500/20">
          <CookingPot size={32} />
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight text-zinc-900">MikhunApp — Panel</h1>
        <p className="mt-1 text-center text-sm text-zinc-600">Gestiona tu menú, combos y pedidos en un solo lugar.</p>

        {msg && (
          <div id="login-error" role="alert" aria-live="polite" className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{msg}</span>
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">Email</label>
            <div className="relative mt-1">
              <Mail size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input id="email" type="email" autoComplete="username" required autoFocus
                className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="tu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700">Contraseña</label>
            <div className="relative mt-1">
              <Lock size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"/>
              <input id="password" type={showPass ? "text" : "password"} autoComplete="current-password" required
                className="w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-12 text-sm outline-none transition focus:border-green-500 focus:ring-1 focus:ring-green-500"
                placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))} />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute inset-y-0 right-0 my-auto flex items-center rounded-r-xl px-3 text-zinc-500 hover:text-zinc-800"
                title={showPass ? "Ocultar contraseña" : "Mostrar contraseña"} tabIndex={-1}>
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {capsOn && 
              <div id="caps-hint" className="mt-1.5 text-xs text-amber-700 flex items-center gap-1.5">
                <Keyboard size={14} /> Bloq Mayús activado
              </div>
            }
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <label className="inline-flex select-none items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox"
              className="h-4 w-4 rounded border-zinc-300 text-green-600 focus:ring-green-500"
              checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Recordarme
          </label>
        </div>

        <button
          type="submit"
          disabled={!canSubmit}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-green-500/20 transition hover:bg-green-700 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading && <Loader2 className="h-5 w-5 animate-spin" />}
          {loading ? "Verificando..." : "Entrar"}
        </button>

        <p className="mt-6 text-center text-xs text-zinc-500">
          © {new Date().getFullYear()} MikhunApp — Panel
        </p>
      </form>
    </div>
  );
}
