// src/App.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import { BrowserRouter } from "react-router-dom";
import { crearOActualizarIntent, abandonarIntent } from "./services/checkout";
import { crearIntentTakeaway } from "./services/checkout.takeaway";
import AnimatedRoutes from "./AnimatedRoutes";
import BillingModal from "./components/BillingModal";

import CartBar from "./components/CartBar";
import CartSheet from "./components/CartSheet";
import MenuProvider from "./hooks/MenuProvider.jsx";
import { useMenuPublic } from "./hooks/useMenuPublic";
import { apiResolveMesaId, apiCreatePedido } from "./services/api";
import { getMP } from "./lib/mpClient";
import {
  FALLBACK_IMG,
  formatPEN as formatPENUtil,
  absolute as makeAbsolute,
} from "./lib/ui.js";

// ==================== util ====================
const API_BASE =
  import.meta.env.VITE_API_PEDIDOS ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:4000";

const absolute = (url) => makeAbsolute(API_BASE, url);
const formatPEN = formatPENUtil;

// ==================== CSRF helpers ====================
function getCookie(name) {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
function withCsrf(headers = {}) {
  const csrf =
    getCookie("csrf_token") ||
    getCookie("XSRF-TOKEN") ||
    getCookie("_csrf") ||
    null;
  return csrf ? { ...headers, "x-csrf-token": csrf } : headers;
}
async function ensureCsrfCookie() {
  if (getCookie("csrf_token")) return;
  try {
    await fetch(`${API_BASE}/api/csrf`, { credentials: "include" });
  } catch {}
}

// ==================== carrito ====================
function useCart() {
  const [cart, setCart] = useState([]);

  useEffect(() => {
    const onAdd = (e) => {
      const it = e.detail.item;
      setCart((prev) => {
        if (!it.isCombo) {
          const found = prev.find((p) => !p.isCombo && p.id === it.id);
          return found
            ? prev.map((p) =>
                p === found ? { ...p, cantidad: p.cantidad + 1 } : p
              )
            : [...prev, { ...it, cantidad: 1 }];
        }
        return [...prev, { ...it, cantidad: 1 }];
      });
    };
    window.addEventListener("cart:add", onAdd);
    return () => window.removeEventListener("cart:add", onAdd);
  }, []);

  const total = useMemo(
    () => cart.reduce((s, i) => s + Number(i.precio || 0) * i.cantidad, 0),
    [cart]
  );
  const itemCount = useMemo(
    () => cart.reduce((a, i) => a + i.cantidad, 0),
    [cart]
  );

  const addAt = (idx) =>
    setCart((prev) =>
      prev.map((i, k) => (k === idx ? { ...i, cantidad: i.cantidad + 1 } : i))
    );
  const removeAt = (idx) =>
    setCart((prev) =>
      prev
        .map((i, k) => (k === idx ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0)
    );
  return { cart, setCart, total, itemCount, addAt, removeAt };
}

const cartSnapshot = (cart) =>
  cart.map((i) => ({
    id: i.isCombo ? `combo:${i.comboId}` : i.id,
    name: i.isCombo ? `Combo ${i.comboId}` : i.nombre,
    qty: i.cantidad,
    price: Number(i.precio ?? 0),
  }));

const genIdem = () =>
  crypto?.randomUUID?.() ||
  `${Date.now()}_${Math.random().toString(16).slice(2)}`;

function useUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    restaurantId: Number(p.get("restaurantId") || 1),
    mesaId: (p.get("mesaId") && Number(p.get("mesaId"))) || null,
    mesaCode: p.get("mesaCode") || null,
  };
}

// === Helper para detectar Takeaway por URL/mesaCode ===
function useIsTakeaway(mesaCode) {
  return useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    const mesaCodeUpper = String(mesaCode || "").toUpperCase();
    return qs.get("takeaway") === "1" || mesaCodeUpper === "LLEVAR";
  }, [mesaCode]);
}

const parseJwt = (t) => {
  try {
    return JSON.parse(atob(t.split(".")[1]));
  } catch {
    return {};
  }
};

/* ==================== App ==================== */
export default function App() {
  return (
    <BrowserRouter>
      <MenuProvider>
        <AppInner />
      </MenuProvider>
    </BrowserRouter>
  );
}

function AppInner() {
  const { cart, setCart, total, itemCount, addAt, removeAt } = useCart();
  const { billingMode } = useMenuPublic();

  const [openCart, setOpenCart] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [openBilling, setOpenBilling] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);

  // instancia MP React
  const [MP, setMP] = useState(null);

  const [orderInfo, setOrderInfo] = useState(null); // { intentId, amount, restaurantId, pedidoId }
  const [showCard, setShowCard] = useState(false);

  const { mesaId, restaurantId, mesaCode } = useUrlParams();
  const isTakeaway = useIsTakeaway(mesaCode);

  // Snapshot para mostrar en BillingModal
  const [checkoutSummary, setCheckoutSummary] = useState([]);

  // Nota para cocina (paso previo)
  const [openNote, setOpenNote] = useState(false);
  const [checkoutNote, setCheckoutNote] = useState("");

  useEffect(() => {
    ensureCsrfCookie();
  }, []);

  // valor inicial seguro para la variable, CartBar luego la sobrescribe con la altura real
  useEffect(() => {
    document.documentElement.style.setProperty("--cart-bar-h", "0px");
  }, []);

    const autoLogin = useCallback(async () => {
    try {
      // 1) Leer cualquier token que exista en storage
      let token =
        sessionStorage.getItem("client_token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("client_token") ||
        localStorage.getItem("token") ||
        null;

      const clearStorages = () => {
        sessionStorage.removeItem("client_token");
        sessionStorage.removeItem("token");
        localStorage.removeItem("client_token");
        localStorage.removeItem("token");
      };

      if (token) {
        const payload = parseJwt(token);
        const now = Math.floor(Date.now() / 1000);

        const ridToken = Number(
          payload?.restaurantId ?? payload?.restaurant_id ?? 0
        );
        const exp = Number(payload?.exp || 0);
        const role = payload?.role;

        const invalid =
          !ridToken ||
          ridToken !== Number(restaurantId) ||
          !exp ||
          exp <= now + 60 || // vencido o por vencer en 1 minuto
          role !== "client";

        if (invalid) {
          clearStorages();
          token = null;
        }
      }

      // 2) Si no hay token válido → pedir uno nuevo al backend
      if (!token) {
        await ensureCsrfCookie();
        const headers = withCsrf({ "Content-Type": "application/json" });

        const res = await fetch(`${API_BASE}/api/auth/login-cliente`, {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ restaurantId }),
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || "login-cliente falló");
        }

        const data = await res.json();
        token = data.token || null;
        if (!token) throw new Error("Backend no devolvió token");

        // Guardamos SOLO en sessionStorage
        sessionStorage.setItem("client_token", token);
        sessionStorage.setItem("token", token);
        // Limpiamos restos viejos
        localStorage.removeItem("client_token");
        localStorage.removeItem("token");
      }

      return token;
    } catch (err) {
      console.error("autoLogin:", err);
      throw new Error("No se pudo autenticar al cliente");
    }
  }, [restaurantId]);


  const mapCartToPedidoItems = (c) =>
    c.map((i) => {
      if (i.isCombo) {
        const base = { combo_id: i.comboId, cantidad: i.cantidad };
        // Soporte V2 (grupos)
        if (Array.isArray(i.grupos) && i.grupos.length) return { ...base, grupos: i.grupos };
        // Fallback legacy
        if (i.entrada?.id) base.entradaId = i.entrada.id;
        if (i.plato?.id) base.platoId = i.plato.id;
        return base;
      }
      return { menu_item_id: i.id, cantidad: i.cantidad };
    });

  const handlePay = useCallback(
    async (billing) => {
      try {
        setBillingLoading(true);

        // Lo que viene del modal (UI): 'sunat' | 'simple'
        const modeFromForm =
          billing?.mode ?? (billingMode === "sunat" ? "sunat" : "simple");
        const isSunatOrder = modeFromForm === "sunat";

        // Lo que entiende el backend/webhook: 'sunat' | 'nosunat'
        const billingModeForBackend = isSunatOrder ? "sunat" : "nosunat";

        if (!total || total <= 0) {
          alert("Tu carrito está vacío.");
          setBillingLoading(false);
          return;
        }

        await autoLogin();

        // (1) Resolver mesaIdToUse
        let mesaIdToUse = null;
        if (!isTakeaway) {
          if (mesaId && Number(mesaId) > 0) {
            mesaIdToUse = Number(mesaId);
          } else if (mesaCode) {
            try {
              mesaIdToUse = await apiResolveMesaId(restaurantId, mesaCode);
            } catch {
              mesaIdToUse = null;
            }
          }
          if (!mesaIdToUse) {
            alert("Mesa no válida para este restaurante.");
            setBillingLoading(false);
            return;
          }
        } else {
          if (mesaId && Number(mesaId) > 0) {
            mesaIdToUse = Number(mesaId);
          } else if (mesaCode) {
            try {
              mesaIdToUse = await apiResolveMesaId(restaurantId, mesaCode);
            } catch {
              mesaIdToUse = null;
            }
          }
          if (!mesaIdToUse) {
            alert(
              "QR inválido o falta la mesa 'LLEVAR'. Vuelve a escanear el QR."
            );
            setBillingLoading(false);
            return;
          }
        }

        // (2) Nota
        const rawFromSheet =
          typeof window !== "undefined" ? window.__CHECKOUT_NOTE__ || "" : "";
        const rawFromModal = checkoutNote || "";

        const pieces = [];
        if (rawFromSheet.trim()) pieces.push(rawFromSheet.trim());
        if (rawFromModal.trim()) pieces.push(rawFromModal.trim());
        const noteToUse = pieces.length ? pieces.join(" | ") : null;

        // (3) Tipo de CPE (solo si va por SUNAT)
        const comprobanteTipo = isSunatOrder
          ? billing?.docType === "RUC"
            ? "01"
            : "03"
          : null;

        // (4) Crear PEDIDO
        let pedido = null;
        try {
          pedido = await apiCreatePedido({
            restaurantId,
            mesaId: mesaIdToUse,
            items: mapCartToPedidoItems(cart),
            idempotencyKey: genIdem(),
            comprobanteTipo,
            // Datos del cliente:
            billingClient: isSunatOrder
              ? {
                  tipoDoc: billing?.docType === "RUC" ? "6" : "1",
                  numDoc: billing?.docNumber || "",
                  rznSocial:
                    billing?.docType === "RUC"
                      ? billing?.name || "SIN NOMBRE"
                      : undefined,
                  nombres:
                    billing?.docType === "RUC"
                      ? undefined
                      : billing?.name || "SIN NOMBRE",
                  direccion: billing?.address || undefined,
                  email: billing?.email || undefined,
                }
              : modeFromForm === "simple"
              ? {
                  // En boleta simple guardamos lo básico (útil para el PDF simple)
                  tipoDoc: "1",
                  numDoc: billing?.docNumber || "",
                  nombres: billing?.name || undefined,
                  email: billing?.email || undefined,
                }
              : null,
            billingEmail: billing?.email || null,
            billingMode: billingModeForBackend, // "sunat" | "nosunat"
            note: noteToUse,
          });
        } catch (e) {
          if (e?.response?.status === 409) {
            console.warn("Pedido ya existe (409). Continuamos flujo de pago.");
          } else {
            console.error(
              "PEDIDO ERROR:",
              e?.response?.data || e?.message || e
            );
            alert(
              typeof e?.response?.data === "object"
                ? JSON.stringify(e.response.data)
                : e?.response?.data || e?.message || "Error creando el pedido"
            );
            setBillingLoading(false);
            return;
          }
        }

        // (5) Total/amount del pedido
        const pedidoId = Number(
          pedido?.id ?? pedido?.pedidoId ?? pedido?.pedido_id ?? 0
        );
        if (!pedidoId) {
          console.warn("No se recibió pedidoId del backend ", pedido);
        }

        let amountSoles = null;
        if (pedido?.total != null) amountSoles = Number(pedido.total);
        else if (pedido?.amount != null) {
          const a = Number(pedido.amount);
          amountSoles = a >= 100 ? a / 100 : a;
        } else {
          amountSoles = Number(total.toFixed(2));
        }

        // (6) Crear INTENT
        let intent = null;
        try {
          const payloadIntent = {
            restaurantId,
            amount: Number(amountSoles.toFixed(2)),
            cart: cartSnapshot(cart),
            note: noteToUse,
            metadata: {
              billing_mode: billingModeForBackend, // consistente con backend/webhook
              mesaId: mesaIdToUse || null,
            },
          };
          if (!isTakeaway && mesaIdToUse) {
            payloadIntent.mesaId = mesaIdToUse;
          }

          intent = isTakeaway
            ? await crearIntentTakeaway(payloadIntent)
            : await crearOActualizarIntent(payloadIntent);
        } catch (e) {
          console.error("INTENT ERROR:", e?.response?.data || e?.message || e);
          // Podemos permitir efectivo aunque falle la creación del intent
        }

        // (7) Info para modal
        setOrderInfo({
          intentId: intent?.id || null,
          restaurantId,
          mesaId: mesaIdToUse,
          pedidoId: pedidoId || null,
          amount: Number(amountSoles),
          email: billing?.email || "cliente@example.com",
        });

        // (8) Snapshot para el modal
        setCheckoutSummary(
          cart.map((i) => ({
            name: i.isCombo ? `Combo ${i.comboId}` : i.nombre,
            qty: i.cantidad,
            price: Number(i.precio || 0),
          }))
        );

        // (9) Inicializa MP React
        try {
          const mod = await getMP(restaurantId);
          setMP(mod);
          await new Promise((r) => setTimeout(r, 0));
          setShowCard(true);
          setOpenBilling(true);
        } catch (e) {
          console.error("MP init error:", e?.message || e);
          alert("No se pudo inicializar el pago con tarjeta.");
          setBillingLoading(false);
          return;
        }
      } catch (e) {
        console.error("INTENT/PEDIDO ERROR:", e?.response?.data || e?.message);
        alert(
          typeof e?.response?.data === "object"
            ? JSON.stringify(e?.response?.data)
            : e?.response?.data || e?.message
        );
      } finally {
        setBillingLoading(false);
      }
    },
    [
      total,
      mesaId,
      mesaCode,
      restaurantId,
      cart,
      autoLogin,
      billingMode,
      checkoutNote,
      isTakeaway,
    ]
  );

  return (
    <>
      {mensaje && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-700">
            {mensaje}
          </div>
        </div>
      )}

      <div
        className="min-h-svh flex flex-col overflow-x-hidden"
        style={{
          // Usa SIEMPRE la altura real que publica CartBar (mobile/desktop),
          // con fallback a 0px cuando no existe carrito.
          paddingBottom:
            "calc(var(--cart-bar-h, 0px) + env(safe-area-inset-bottom))",
        }}
      >
        <AnimatedRoutes />
      </div>

      <CartBar
        itemCount={itemCount}
        total={total}
        formatPEN={formatPEN}
        onOpenCart={() => setOpenCart(true)}
        onSend={() => {}}
        onPay={() => {
          setShowCard(false);
          setOpenNote(true);
        }}
      />

      <CartSheet
        open={openCart}
        onClose={() => setOpenCart(false)}
        cart={cart}
        total={total}
        formatPEN={formatPEN}
        absolute={absolute}
        fallbackImg={FALLBACK_IMG}
        onAdd={addAt}
        onRemove={removeAt}
        onSend={() => {}}
        onPay={() => {
          setOpenCart(false);
          setShowCard(false);
          setOpenNote(true);
        }}
      />

      {/* Paso 0: Nota para cocina */}
      <NoteModal
        open={openNote}
        note={checkoutNote}
        onChange={setCheckoutNote}
        onClose={() => setOpenNote(false)}
        onContinue={() => {
          setOpenNote(false);
          setShowCard(false);
          setOpenBilling(true);
        }}
      />

      {/* Paso 1+: Datos de facturación / pago */}
      <BillingModal
        key={`${orderInfo?.intentId || "form"}:${showCard ? 1 : 0}`} // fuerza remount limpio
        open={openBilling}
        onClose={() => {
          setOpenBilling(false);
          setShowCard(false);
        }}
        loading={billingLoading}
        onSubmit={(data) => handlePay(data)}
        MP={MP}
        showCard={showCard}
        orderInfo={orderInfo}
        onBackToForm={() => setShowCard(false)}
        orderSummary={checkoutSummary}
        orderNote={
          checkoutNote ||
          (typeof window !== "undefined"
            ? window.__CHECKOUT_NOTE__ || ""
            : "")
        }
        // ------- EFECTIVO: implementación -------
        onPayCash={async ({ amount }) => {
          try {
            // Si existe un intent de tarjeta, lo abandonamos porque se pagará en caja
            if (orderInfo?.intentId) {
              try {
                await abandonarIntent(orderInfo.intentId);
              } catch {}
            }
            // (Opcional) podrías marcar el pedido como "pendiente en caja" en tu backend aquí.

            return { amount, pedidoId: orderInfo?.pedidoId || null };
          } catch (e) {
            console.error("onPayCash:", e?.response?.data || e?.message);
            return { amount, pedidoId: orderInfo?.pedidoId || null };
          }
        }}
      />
    </>
  );
}

/* ---------- Modal: Nota para cocina ---------- */
function NoteModal({ open, note, onChange, onClose, onContinue }) {
  if (!open) return null;

  const limit = 300;
  const len = note?.length || 0;
  const nearLimit = len > limit - 50 && len < limit;
  const overLimit = len >= limit;

  const suggestions = [
    "Sin cebolla",
    "Sin arroz",
    "Poco picante",
    "Con presa pechuga",
    "Sin culantro",
    "Salsa aparte",
  ];

  const addSuggestion = (txt) => {
    const clean = String(txt).trim();
    if (!clean) return;
    const current = String(note || "").trim();
    const exists = current.toLowerCase().includes(clean.toLowerCase());
    const next = exists ? current : current ? `${current}, ${clean}` : clean;
    onChange(next.slice(0, limit));
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6"
      style={{
        background:
          "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35))",
      }}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="
        w-full max-w-lg overflow-hidden
        rounded-3xl border border-white/10 bg-white/80 backdrop-blur-xl
        shadow-[0_10px_40px_-5px_rgba(0,0,0,.25)] ring-1 ring-black/5
      "
      >
        <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-white/70 to-white/40">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900">
            NOTA PARA COCINA{" "}
            <span className="text-neutral-400 font-normal">(opcional)</span>
          </h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[13px] text-neutral-600">
            ¿Algo especial para tu plato? Ej.: sin arroz, con presa específica,
            sin cebolla, etc.
          </p>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => addSuggestion(s)}
                className="rounded-full border border-emerald-200 bg-emerald-50/60 px-3 py-1
                           text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="relative">
            <textarea
              id="order-note"
              rows={4}
              maxLength={300}
              value={note}
              onChange={(e) => onChange(e.target.value)}
              className="
                peer w-full resize-y rounded-2xl border bg-white px-3.5 pt-6 pb-3 text-[15px]
                text-neutral-900 outline-none transition
                border-neutral-300 placeholder:text-transparent
                focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100
              "
              placeholder="Ej.: sin arroz y con presa pechuga, por favor."
            />
            <label
              htmlFor="order-note"
              className="
                pointer-events-none absolute left-3.5 top-2 text-[11px] font-medium
                text-neutral-600 transition
                peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[14px]
                peer-focus:top-2 peer-focus:text-[11px] peer-focus:text-emerald-600
              "
            >
              Ej.: sin arroz y con presa pechuga, por favor.
            </label>

            <div
              className={`absolute bottom-2.5 right-3 text-[11px] ${
                overLimit
                  ? "text-rose-600"
                  : nearLimit
                  ? "text-amber-600"
                  : "text-neutral-400"
              }`}
            >
              {len}/{limit}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t bg-white/95 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="rounded-xl bg-gradient-to-t from-emerald-600 to-emerald-500 px-4 py-2
                       text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20
                       transition hover:from-emerald-500 hover:to-emerald-400"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
