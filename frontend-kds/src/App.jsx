// src/App.jsx
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";
const TZ = "America/Lima";

/* ========================
 * Helpers
 * ======================== */

// Lee el token CSRF de la cookie csrf_token
const getCsrfToken = () => {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : "";
};

// Intentamos leer auth guardado (token + user) del localStorage
function getInitialAuth() {
  try {
    const raw = localStorage.getItem("kitchenAuth");
    if (!raw) return { token: "", user: null };
    return JSON.parse(raw);
  } catch {
    return { token: "", user: null };
  }
}

// Hora HH:mm en Lima
function formatHoraPedido(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(d);
}

// Badge sencillo
function StatusBadge({ label, tone }) {
  const colors = {
    success: { bg: "#DCFCE7", text: "#166534", dot: "#16A34A" },
    warning: { bg: "#FEF9C3", text: "#854D0E", dot: "#EAB308" },
    info: { bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
    muted: { bg: "#E5E7EB", text: "#374151", dot: "#6B7280" },
  }[tone || "muted"];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 999,
        backgroundColor: colors.bg,
        color: colors.text,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: colors.dot,
        }}
      />
      {label}
    </span>
  );
}

/* ========================
 * Componentes de UI
 * ======================== */

function KdsLoginScreen({ onLogin, error, estado }) {
  const isLoading = estado === "Autenticando…";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "linear-gradient(135deg, #E0F2FE 0%, #ECFDF5 40%, #F9FAFB 100%)",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          backgroundColor: "white",
          borderRadius: 20,
          boxShadow: "0 18px 40px rgba(15,23,42,0.18)",
          padding: 24,
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 12 }}
        >
          <span style={{ fontSize: 32, marginRight: 8 }}>🍳</span>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: 0,
                color: "#111827",
              }}
            >
              Panel de Cocina
            </h1>
            <p
              style={{
                margin: 0,
                marginTop: 4,
                fontSize: 13,
                color: "#6B7280",
              }}
            >
              Ingresa con tu usuario de restaurante para ver los pedidos en
              tiempo real.
            </p>
          </div>
        </div>

        <form onSubmit={onLogin} style={{ marginTop: 20 }}>
          <label style={{ display: "block", fontSize: 13, color: "#374151" }}>
            Correo
            <input
              type="email"
              name="email"
              required
              placeholder="cocina@restaurante.com"
              style={{
                marginTop: 4,
                width: "100%",
                padding: "9px 10px",
                borderRadius: 10,
                border: "1px solid #D1D5DB",
                fontSize: 14,
              }}
            />
          </label>

          <label
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 13,
              color: "#374151",
            }}
          >
            Contraseña
            <input
              type="password"
              name="password"
              required
              placeholder="********"
              style={{
                marginTop: 4,
                width: "100%",
                padding: "9px 10px",
                borderRadius: 10,
                border: "1px solid #D1D5DB",
                fontSize: 14,
              }}
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "10px 14px",
              borderRadius: 999,
              border: "none",
              backgroundColor: "#059669",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              cursor: isLoading ? "default" : "pointer",
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            {isLoading ? "Autenticando…" : "Entrar a cocina"}
          </button>
        </form>

        {error && (
          <p
            style={{
              marginTop: 14,
              fontSize: 13,
              color: "#B91C1C",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: 16,
            fontSize: 11,
            color: "#9CA3AF",
            textAlign: "center",
          }}
        >
          El acceso está vinculado a tu restaurante. Los pedidos que veas aquí
          corresponden solo a ese local.
        </p>
      </div>
    </div>
  );
}

function PedidoCard({ pedido, kitchenState, onToggleKitchen }) {
  const isPagado = String(pedido.estado).toLowerCase() === "pagado";
  const hora = formatHoraPedido(pedido.created_at);
  const cocinaLabel =
    kitchenState === "entregado" ? "Cocina: Entregado" : "Cocina: En preparación";

  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid #A7F3D0",
        backgroundColor: "#ECFDF5",
        padding: 16,
        marginBottom: 16,
        boxShadow: "0 8px 20px rgba(16,185,129,0.15)",
        maxWidth: 460,
        width: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#064E3B",
            }}
          >
            Mesa {pedido.mesa}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 13,
              color: "#6B7280",
            }}
          >
            Pedido #{pedido.numero ?? pedido.id}
            {hora ? ` · ${hora}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusBadge
            label={isPagado ? "Pagado" : "Pendiente de pago"}
            tone={isPagado ? "success" : "warning"}
          />
          <StatusBadge
            label={cocinaLabel}
            tone={kitchenState === "entregado" ? "info" : "muted"}
          />
        </div>
      </div>

      {/* Items */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: "1px solid #D1FAE5",
        }}
      >
        {(pedido.items || []).map((item, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
              fontSize: 14,
              color: "#374151",
            }}
          >
            <span>
              <strong>{item.cantidad}×</strong> {item.nombre}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              S/ {Number(item.precio_unitario).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              textTransform: "uppercase",
              color: "#6B7280",
            }}
          >
            Total
          </div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#047857",
            }}
          >
            S/ {Number(pedido.monto || 0).toFixed(2)}
          </div>
        </div>

        <button
          onClick={onToggleKitchen}
          style={{
            padding: "8px 16px",
            borderRadius: 999,
            border: "none",
            backgroundColor: kitchenState === "entregado" ? "#E5E7EB" : "#10B981",
            color: kitchenState === "entregado" ? "#374151" : "white",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {kitchenState === "entregado"
            ? "Marcar en preparación"
            : "Marcar entregado"}
        </button>
      </div>
    </div>
  );
}

function KdsDisplayScreen({
  user,
  estado,
  error,
  pedidos,
  kitchenStateMap,
  onToggleKitchen,
  onLogout,
}) {
  const isConnected = estado === "Conectado";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundColor: "#F3F4F6",
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid #E5E7EB",
          backgroundColor: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 20 }}>🔎</span>
              <h1
                style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: "#111827",
                }}
              >
                Panel de Cocina
              </h1>
            </div>
            <p
              style={{
                margin: 0,
                marginTop: 2,
                fontSize: 12,
                color: "#6B7280",
              }}
            >
              Pedidos en tiempo real • Restaurante #{user.restaurantId}
            </p>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
          >
            {/* Estado socket */}
            <StatusBadge
              label={
                error && !isConnected ? `${estado} (${error})` : estado
              }
              tone={isConnected ? "success" : "warning"}
            />
            {/* Usuario */}
            <div style={{ textAlign: "right", fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>{user.nombre}</div>
              <div style={{ color: "#6B7280" }}>{user.email}</div>
            </div>
            {/* Logout */}
            <button
              onClick={onLogout}
              style={{
                width: 34,
                height: 34,
                borderRadius: "999px",
                border: "1px solid #D1D5DB",
                backgroundColor: "#FFFFFF",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              title="Cerrar sesión"
            >
              ⏏
            </button>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main
        style={{
          flex: 1,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        {pedidos.length === 0 ? (
          <div
            style={{
              flex: 1,
              borderRadius: 16,
              border: "2px dashed #D1D5DB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#6B7280",
              fontSize: 15,
            }}
          >
            Aún no hay pedidos. Esperando órdenes de los clientes…
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              alignItems: "flex-start",
            }}
          >
            {pedidos.map((p) => (
              <PedidoCard
                key={p.id}
                pedido={p}
                kitchenState={kitchenStateMap[p.id] || "preparacion"}
                onToggleKitchen={() => onToggleKitchen(p.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/* ========================
 * APP PRINCIPAL
 * ======================== */

function App() {
  const [auth, setAuth] = useState(getInitialAuth);
  const [pedidos, setPedidos] = useState([]);
  const [estado, setEstado] = useState("Desconectado");
  const [error, setError] = useState("");
  const [kitchenStateMap, setKitchenStateMap] = useState({}); // { idPedido: "preparacion" | "entregado" }

  const token = auth.token;
  const user = auth.user;

  // Sembramos la cookie CSRF al cargar la app (GET /api/csrf)
  useEffect(() => {
    fetch(`${API_URL}/api/csrf`, {
      method: "GET",
      credentials: "include",
    }).catch(() => {});
  }, []);

  // Manejo Socket.IO
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      transports: ["websocket"],
      auth: { token },
    });

    setEstado("Conectando…");
    setError("");

    // utilitario para hacer upsert de un pedido
    const upsertPedido = (pedido) => {
      setPedidos((prev) => {
        const idx = prev.findIndex((p) => p.id === pedido.id);
        if (idx === -1) {
          return [pedido, ...prev];
        }
        const clone = [...prev];
        clone[idx] = { ...clone[idx], ...pedido };
        return clone;
      });
    };

    socket.on("connect", () => {
      setEstado("Conectado");
      setError("");
      console.log("✅ KDS conectado");
    });

    socket.on("connect_error", (err) => {
      setEstado("Error");
      setError(err?.message || "Error de conexión");
      console.error("❌ Socket error:", err);
    });

    socket.on("disconnect", () => {
      setEstado("Desconectado");
      console.log("ℹ️ KDS desconectado");
    });

    // Lista inicial de pedidos
    socket.on("init_pedidos", (lista) => {
      const arr = Array.isArray(lista) ? lista : [];
      setPedidos(arr);
      // todos empiezan "En preparación" en la vista de cocina
      const initialStates = {};
      for (const p of arr) {
        initialStates[p.id] = "preparacion";
      }
      setKitchenStateMap(initialStates);
    });

    // Nuevo pedido
    socket.on("nuevo_pedido", (pedido) => {
      console.log("📥 nuevo_pedido", pedido);
      upsertPedido(pedido);
      setKitchenStateMap((prev) => ({
        ...prev,
        [pedido.id]: prev[pedido.id] || "preparacion",
      }));
    });

    // Pedido pagado
    socket.on("pedido_pagado", (pedido) => {
      console.log("📥 pedido_pagado", pedido);
      upsertPedido(pedido);
      setKitchenStateMap((prev) => ({
        ...prev,
        [pedido.id]: prev[pedido.id] || "preparacion",
      }));
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token]);

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const password = String(form.get("password") || "");

    if (!email || !password) {
      setError("Ingresa correo y contraseña");
      return;
    }

    try {
      setError("");
      setEstado("Autenticando…");

      const csrfToken = getCsrfToken();

      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken || "",
        },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let data = {};
        try {
          data = await res.json();
        } catch (_) {}
        throw new Error(data.error || "Credenciales inválidas");
      }

      const data = await res.json(); // { token, user }
      if (!data.token || !data.user) {
        throw new Error("Respuesta de login inválida");
      }

      const newAuth = { token: data.token, user: data.user };
      setAuth(newAuth);
      localStorage.setItem("kitchenAuth", JSON.stringify(newAuth));
      setPedidos([]);
      setKitchenStateMap({});
      setEstado("Conectando…");
    } catch (err) {
      console.error("login KDS:", err);
      setEstado("Desconectado");
      setError(err.message || "Error al iniciar sesión");
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem("kitchenAuth");
    setAuth({ token: "", user: null });
    setPedidos([]);
    setKitchenStateMap({});
    setEstado("Desconectado");
    setError("");
  };

  // Cambiar estado cocina (solo UI)
  const handleToggleKitchen = (pedidoId) => {
    setKitchenStateMap((prev) => {
      const current = prev[pedidoId] || "preparacion";
      return {
        ...prev,
        [pedidoId]: current === "entregado" ? "preparacion" : "entregado",
      };
    });
  };

  // Si no hay token, mostramos login
  if (!token || !user) {
    return (
      <KdsLoginScreen onLogin={handleLogin} error={error} estado={estado} />
    );
  }

  // Vista principal
  return (
    <KdsDisplayScreen
      user={user}
      estado={estado}
      error={error}
      pedidos={pedidos}
      kitchenStateMap={kitchenStateMap}
      onToggleKitchen={handleToggleKitchen}
      onLogout={handleLogout}
    />
  );
}

export default App;
