// src/pages/Login.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

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

  // evita dobles navegaciones
  const navigated = useRef(false);
  const safeNavigate = (to) => {
    if (navigated.current) return;
    navigated.current = true;
    navigate(to, { replace: true });
  };

  // Ejecuta la validación una sola vez
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const ctrl = new AbortController();
    (async () => {
      try {
        // Pide refresh mediante el contexto (esto guarda dbToken si es válido)
        const ok = await refreshDbToken({ signal: ctrl.signal });
        console.log("[LOGIN] refreshDbToken ok?", ok);

        if (ok) {
          const to = loc.state?.from?.pathname || "/dashboard";
          safeNavigate(to);
          return;
        }

        // Sin sesión: muestra el formulario
        sessionStorage.removeItem("dbToken");
      } catch {
        sessionStorage.removeItem("dbToken");
      } finally {
        setChecking(false);
      }
    })();

    return () => ctrl.abort();
  }, [loc.state, refreshDbToken]); // navigate NO va en deps para evitar loops

  const emailOk = email.trim() !== "";
  const passOk = password !== "";
  const canSubmit = emailOk && passOk && !loading;

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setMsg("");

    try {
      setLoading(true);
      console.log("[LOGIN] submit:", { email: email.trim() });

      // 1) Tu login: setea dbToken en el contexto/sessionStorage
      const out = await login(email.trim(), password);

      

      // 3) “Recordarme”
      if (remember) localStorage.setItem("persist", "1");
      else localStorage.removeItem("persist");

      // 4) Redirige (una sola vez)
      const to = loc.state?.from?.pathname || "/dashboard";
      safeNavigate(to);
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
        <span className="sr-only">Verificando sesión…</span>
      </div>
    );
  }

  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50 via-white to-neutral-200" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-emerald-400/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-[500px] w-[500px] rounded-full bg-emerald-400/25 blur-3xl" />

      <form onSubmit={handleLogin} className="relative z-10 w-full max-w-md rounded-3xl bg-white/90 p-6 shadow-xl ring-1 ring-black/5 backdrop-blur" aria-busy={loading ? "true" : "false"}>
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-700 text-white shadow-lg">
          <span className="text-lg font-bold">MG</span>
        </div>

        <h1 className="text-center text-2xl font-bold tracking-tight">Mikhunapp — Panel Admin</h1>
        <p className="mt-1 text-center text-sm text-neutral-600">Gestiona tu menú, combos y pedidos en un solo lugar.</p>

        {msg && (
          <div id="login-error" role="alert" aria-live="polite" className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
            {msg}
          </div>
        )}

        <label htmlFor="email" className="mt-6 block text-sm font-medium text-neutral-900">Email</label>
        <input
          id="email"
          type="email"
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="username"
          required
          autoFocus
          className="mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500"
          placeholder="admin@demo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!emailOk}
          aria-describedby={msg ? "login-error" : undefined}
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium text-neutral-900">Contraseña</label>
        <div className="relative mt-1">
          <input
            id="password"
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            required
            className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 pr-12 text-sm outline-none transition focus:border-emerald-500"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState && e.getModifierState("CapsLock"))}
            aria-invalid={!passOk}
            aria-describedby={`${capsOn ? "caps-hint " : ""}${msg ? "login-error" : ""}`.trim() || undefined}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-2 my-auto rounded-md px-2 text-xs text-neutral-600 hover:bg-neutral-100"
            onClick={() => setShowPass((v) => !v)}
            aria-pressed={showPass ? "true" : "false"}
            aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
            tabIndex={-1}
          >
            {showPass ? "Ocultar" : "Ver"}
          </button>
        </div>
        {capsOn && <div id="caps-hint" className="mt-1 text-xs text-amber-700">Bloq Mayús activado</div>}

        <label className="mt-3 inline-flex select-none items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Recordarme
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          onClick={() => console.log("[LOGIN] button clicked")}
          className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-80"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>

        <p className="mt-5 text-center text-xs text-neutral-500">
          © {new Date().getFullYear()} Mikhunapp — Panel
        </p>
      </form>
    </div>
  );
}
