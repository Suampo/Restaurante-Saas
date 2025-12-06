// src/components/BillingModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import { payWithCardViaBrick, payWithYape } from "../services/mercadopago";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { abandonarIntent } from "../services/checkout";

/* ===================== ICONS ===================== */
const IconCard = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path
      fill="currentColor"
      d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm13 5H5v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6zM7 16h4a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z"
    />
  </svg>
);
const IconYape = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path
      fill="currentColor"
      d="M17 2H7a3 3 0 0 0-3 3v14l4-3h9a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3z"
    />
  </svg>
);
const IconCash = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" {...p}>
    <path
      fill="currentColor"
      d="M3 6h18v12H3zM5 8v8h14V8H5zm7 2a3 3 0 110 6 3 3 0 010-6z"
    />
  </svg>
);
const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...p}>
    <path
      fill="currentColor"
      d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"
    />
  </svg>
);
const IconCheckCircle = (p) => (
  <svg
    viewBox="0 0 24 24"
    width="48"
    height="48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...p}
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/* ===================== MODAL PRINCIPAL ===================== */
export default function BillingModal({
  open,
  onClose,
  loading = false,
  onSubmit,
  onPayCash,
  MP,
  showCard = false,
  orderInfo = null,
  onBackToForm,
  orderSummary = [],
  orderNote = "",
}) {
  const { billingMode } = useMenuPublic();
  const allowSunat = billingMode === "sunat";

  const [mode, setMode] = useState(allowSunat ? "sunat" : "simple");

  // Form states
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [comprobante, setComprobante] = useState("boleta");
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [address, setAddress] = useState("");

  // UI states
  const [success, setSuccess] = useState(null);
  const [cashCreated, setCashCreated] = useState(null);
  const [processing, setProcessing] = useState(false);

  const amountSoles = useMemo(
    () => Math.max(1, Number(orderInfo?.amount || 0)),
    [orderInfo?.amount]
  );

  // 👇 Número "bonito" de pedido (por restaurante) para mostrar en la UI
  const pedidoNumeroBase = useMemo(() => {
    const o = orderInfo || {};
    return (
      o.numero ??
      o.orderNumber ??
      o.order_no ??
      o.pedidoNumero ??
      o.pedido_numero ??
      o.pedidoId ??
      null
    );
  }, [orderInfo]);

  const isSunatBoleta = mode === "sunat" && comprobante === "boleta";
  const isSunatFactura = mode === "sunat" && comprobante === "factura";
  const isSimple = mode === "simple";

  useEffect(() => {
    if (!open) {
      setSuccess(null);
      setCashCreated(null);
      setProcessing(false);
      setMode(allowSunat ? "sunat" : "simple");
    }
  }, [open, allowSunat]);

  if (!open) return null;

  const submitForm = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const commonData = { mode, docType, docNumber, name, email };
      if (mode === "sunat") {
        await onSubmit?.({
          ...commonData,
          comprobante,
          address,
        });
      } else {
        await onSubmit?.({
          ...commonData,
          docType: "DNI",
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  const handleHeaderClose = async () => {
    if (showCard && orderInfo?.intentId && !success) {
      try {
        await abandonarIntent(orderInfo.intentId);
      } catch {}
    }
    onClose?.();
  };

  // ✅ Pago con tarjeta aprobado
  const showSuccess = (amount) => {
    setSuccess({
      amount: Number(amount || amountSoles || 0),
      pedidoNumero: pedidoNumeroBase,
    });
  };

  // ✅ Pedido generado para pago en efectivo
  const showCashCreated = ({ amount, pedidoId, pedidoNumero }) => {
    const visual =
      pedidoNumero ??
      pedidoNumeroBase ??
      pedidoId ??
      orderInfo?.pedidoId ??
      null;

    setCashCreated({
      amount: Number(amount || amountSoles || 0),
      pedidoNumero: visual,
    });
  };

  const headerTitle = success
    ? "¡Pago Exitoso!"
    : cashCreated
    ? "Pedido Registrado"
    : showCard
    ? "Pago Seguro"
    : mode === "sunat"
    ? "Datos de Facturación"
    : "Datos del Cliente";

  const isFormMode = !success && !cashCreated && !showCard;

  return (
    <div
      className="
        fixed inset-0 z-[9999] flex items-center justify-center
        bg-neutral-900/60 backdrop-blur-sm transition-opacity duration-300
        px-3 sm:px-4 py-6 sm:py-8
      "
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          grid w-full max-w-[480px] sm:max-w-[520px]
          bg-white shadow-2xl ring-1 ring-black/5
          rounded-[32px]
        "
        style={{
          gridTemplateRows: "auto 1fr auto",
          height: "min(620px, calc(100dvh - 48px))",
        }}
      >
        {/* Header */}
        <header className="flex items-center justify-between px-5 py-4 sm:px-6 sm:py-5 border-b border-gray-100 bg-white rounded-t-[32px]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              {headerTitle}
            </h2>
            {!success && !cashCreated && (
              <p className="mt-0.5 text-xs text-gray-500">
                Completa la información para continuar
              </p>
            )}
          </div>
          <button
            type="button"
            className="rounded-full bg-gray-100 p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors focus:outline-none"
            onClick={handleHeaderClose}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </header>

        {/* Cuerpo scrollable */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5 bg-gray-50/50 min-w-0">
          {success ? (
            <SuccessView
              amount={success.amount}
              pedidoNumero={success.pedidoNumero}
              orderSummary={orderSummary}
              note={orderNote}
              onClose={onClose}
            />
          ) : cashCreated ? (
            <CashCreatedView
              amount={cashCreated.amount}
              pedidoNumero={cashCreated.pedidoNumero}
              orderSummary={orderSummary}
              note={orderNote}
              onClose={onClose}
            />
          ) : showCard && orderInfo ? (
            <PayTabs
              MP={MP}
              amountSoles={amountSoles}
              orderInfo={orderInfo}
              buyerName={name}
              buyerEmail={email}
              onBackToForm={async () => {
                if (!success && orderInfo?.intentId) {
                  try {
                    await abandonarIntent(orderInfo.intentId);
                  } catch {}
                }
                onBackToForm?.();
              }}
              orderSummary={orderSummary}
              onMpApproved={() => showSuccess(amountSoles)}
              onCashCreate={async () => {
                if (!onPayCash) return alert("onPayCash no implementado");
                const resp = await onPayCash({ amount: amountSoles });
                showCashCreated({
                  amount: resp?.amount ?? amountSoles,
                  pedidoId: resp?.pedidoId,
                  pedidoNumero:
                    resp?.pedidoNumero ??
                    resp?.orderNumber ??
                    resp?.order_no ??
                    resp?.numero ??
                    null,
                });
              }}
            />
          ) : (
            <form
              id="billing-form"
              onSubmit={submitForm}
              className="mx-auto max-w-xl pb-6"
            >
              {/* Selector Boleta/Factura vs Boleta Simple */}
              <div className="mb-5 flex justify-center">
                <div
                  className="
                    inline-flex w-full max-w-xs rounded-2xl bg-gray-100 p-1 shadow-inner
                    flex-col gap-1
                    sm:flex-row sm:gap-0
                  "
                >
                  {allowSunat && (
                    <TogglePill
                      active={mode === "sunat"}
                      onClick={() => setMode("sunat")}
                    >
                      Boleta / Factura
                    </TogglePill>
                  )}
                  <TogglePill
                    active={mode === "simple"}
                    onClick={() => setMode("simple")}
                  >
                    Boleta Simple
                  </TogglePill>
                </div>
              </div>

              {/* Card principal de datos */}
              <div className="space-y-4 rounded-3xl bg-white p-4 ring-1 ring-gray-100 shadow-sm sm:p-6">
                {mode === "sunat" ? (
                  <>
                    {/* Selector interno: Boleta / Factura */}
                    <div className="mb-3 flex justify-start">
                      <div
                        className="
                          inline-flex w-full max-w-xs flex-col gap-1 rounded-xl border border-gray-100
                          bg-gray-50 p-1 sm:flex-row sm:gap-0
                        "
                      >
                        <TogglePill
                          active={comprobante === "boleta"}
                          onClick={() => {
                            setComprobante("boleta");
                            if (docType !== "DNI") setDocType("DNI");
                          }}
                          small
                        >
                          Boleta
                        </TogglePill>
                        <TogglePill
                          active={comprobante === "factura"}
                          onClick={() => {
                            setComprobante("factura");
                            setDocType("RUC");
                          }}
                          small
                        >
                          Factura
                        </TogglePill>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
                      <div className="sm:col-span-1">
                        <Label>Tipo Documento</Label>
                        <div className="relative">
                          <select
                            className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none disabled:opacity-60"
                            value={docType}
                            onChange={(e) => setDocType(e.target.value)}
                            disabled={isSunatFactura}
                          >
                            <option value="DNI">DNI</option>
                            <option value="RUC" disabled={isSunatBoleta}>
                              RUC
                            </option>
                          </select>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <LabeledInput
                          id="billing-docNumber"
                          label={docType === "RUC" ? "RUC" : "DNI"}
                          value={docNumber}
                          onChange={(v) =>
                            setDocNumber(
                              v
                                .replace(/\D+/g, "")
                                .slice(0, docType === "RUC" ? 11 : 8)
                            )
                          }
                          placeholder="Número de documento"
                          inputMode="numeric"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <LabeledInput
                          id="billing-name-sunat"
                          label={docType === "RUC" ? "Razón Social" : "Nombres"}
                          value={name}
                          onChange={setName}
                          placeholder="Nombre del titular"
                          required
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <LabeledInput
                          id="billing-address"
                          label={
                            isSunatFactura
                              ? "Dirección fiscal"
                              : "Dirección (Opcional)"
                          }
                          value={address}
                          onChange={setAddress}
                          placeholder="Dirección fiscal"
                          required={isSunatFactura}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <LabeledInput
                          id="billing-email-sunat"
                          type="email"
                          label="Email (Opcional)"
                          value={email}
                          onChange={setEmail}
                          placeholder="cliente@email.com"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-3 sm:gap-5">
                      <div className="sm:col-span-1">
                        <LabeledInput
                          id="billing-docNumber-simple"
                          label="DNI (Opcional)"
                          value={docNumber}
                          onChange={(v) =>
                            setDocNumber(
                              String(v).replace(/\D+/g, "").slice(0, 8)
                            )
                          }
                          placeholder="8 dígitos"
                          inputMode="numeric"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <LabeledInput
                          id="billing-name-simple"
                          label="Nombre del cliente"
                          value={name}
                          onChange={setName}
                          placeholder="Nombre del cliente"
                          required={isSimple}
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <LabeledInput
                          id="billing-email-simple"
                          type="email"
                          label="Email (Opcional)"
                          value={email}
                          onChange={setEmail}
                          placeholder="cliente@email.com"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-xs text-blue-700">
                      <span>Comprobante interno sin valor fiscal.</span>
                    </div>
                  </>
                )}
              </div>
            </form>
          )}
        </main>

        {/* Footer fijo */}
        {isFormMode && (
          <footer className="rounded-b-[32px] border-t border-gray-100 bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="billing-form"
                disabled={loading || processing}
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-60"
              >
                {loading || processing ? "Procesando..." : "Continuar"}
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

/* ===================== PAY TABS ===================== */
function PayTabs({
  MP,
  amountSoles,
  orderInfo,
  onBackToForm,
  orderSummary,
  onMpApproved,
  onCashCreate,
}) {
  const [tab, setTab] = useState("card");

  const buyerName = orderInfo?.name || "";
  const buyerEmail = orderInfo?.email || "";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px] pb-4 min-w-0">
      {/* IZQUIERDA */}
      <section className="flex flex-col min-w-0">
        <div
          className="
            flex flex-wrap sm:flex-nowrap
            p-1 bg-gray-100 rounded-xl mb-5 w-full
            gap-1 sm:gap-0
            overflow-x-auto sm:overflow-x-visible no-scrollbar
          "
        >
          <TogglePill active={tab === "card"} onClick={() => setTab("card")}>
            <span className="mr-1.5">
              <IconCard />
            </span>
            Tarjeta
          </TogglePill>
          <TogglePill active={tab === "yape"} onClick={() => setTab("yape")}>
            <span className="mr-1.5">
              <IconYape />
            </span>
            Yape
          </TogglePill>
          <TogglePill active={tab === "cash"} onClick={() => setTab("cash")}>
            <span className="mr-1.5">
              <IconCash />
            </span>
            Efectivo
          </TogglePill>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-gray-100 p-1 shadow-sm min-h-[350px] min-w-0">
          {/* Tarjeta */}
          <div
            className={`${
              tab === "card" ? "block" : "hidden"
            } px-1 py-2 animate-in fade-in zoom-in duration-300`}
          >
            <CardBrick
              MP={MP}
              amountSoles={amountSoles}
              intentId={orderInfo?.intentId}
              restaurantId={orderInfo?.restaurantId}
              pedidoId={orderInfo?.pedidoId}
              buyerName={buyerName}
              buyerEmail={buyerEmail}
              orderSummary={orderSummary}
              onApproved={() => onMpApproved?.()}
            />
          </div>

          {/* Yape */}
          <div
            className={`${
              tab === "yape" ? "block" : "hidden"
            } p-4 sm:p-6 animate-in fade-in slide-in-from-right-4 duration-300`}
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                <IconYape />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Pagar con Yape</h3>
            </div>
            <YapeForm
              amountSoles={amountSoles}
              intentId={orderInfo?.intentId}
              restaurantId={orderInfo?.restaurantId}
              pedidoId={orderInfo?.pedidoId}
              buyerEmail={buyerEmail}
              buyerName={buyerName}
              orderSummary={orderSummary}
              onApproved={() => onMpApproved?.()}
            />
          </div>

          {/* Efectivo */}
          <div
            className={`${
              tab === "cash" ? "block" : "hidden"
            } p-4 sm:p-6 animate-in fade-in slide-in-from-right-4 duration-300`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <IconCash />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                Pagar en Efectivo
              </h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Generaremos tu pedido y quedará pendiente. Porfavor dale a
              "Confirmar " y muestra al mozo el número de tu pedido para
              realizar el cobro.
            </p>
            <button
              type="button"
              onClick={onCashCreate}
              className="w-full rounded-xl bg-gray-900 py-3.5 text-sm font-bold text-white hover:bg-gray-800 transition-all"
            >
              Confirmar (S/ {amountSoles.toFixed(2)})
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-start">
          <button
            type="button"
            onClick={onBackToForm}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 flex items-center gap-1"
          >
            ← Editar datos
          </button>
        </div>
      </section>

      {/* DERECHA: Resumen */}
      <aside className="hidden lg:block h-full min-w-0">
        <div className="h-full rounded-3xl bg-gray-900 p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-20%] right-[-20%] w-40 h-40 rounded-full bg-gray-800/50 blur-2xl pointer-events-none"></div>
          <div>
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Total
            </div>
            <div className="mt-1 text-3xl font-bold text-white tracking-tight">
              S/ {amountSoles.toFixed(2)}
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-400 bg-gray-800/60 py-1 px-2.5 rounded-lg w-fit">
              <IconLock className="w-3 h-3 text-emerald-400" />{" "}
              <span>Seguro 256-bit</span>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-800">
            <div className="text-[10px] text-gray-500 mb-2 font-medium uppercase">
              Ítems
            </div>
            <div className="max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
              <OrderSummary orderSummary={orderSummary} dark />
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:hidden mt-4 min-w-0">
        <div className="rounded-xl bg-gray-50 p-3 border border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="font-bold text-sm text-gray-700">Total</span>
            <span className="font-bold text-lg text-gray-900">
              S/ {amountSoles.toFixed(2)}
            </span>
          </div>
          <div className="pt-2 border-t border-gray-200">
            <OrderSummary orderSummary={orderSummary} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== UI HELPERS & VIEWS ===================== */
function OrderSummary({ orderSummary, dark }) {
  if (!Array.isArray(orderSummary) || orderSummary.length === 0)
    return (
      <div className={`text-xs ${dark ? "text-gray-500" : "text-gray-400"}`}>
        Sin ítems.
      </div>
    );
  return (
    <ul
      className={`space-y-1.5 text-xs ${
        dark ? "text-gray-300" : "text-gray-600"
      }`}
    >
      {orderSummary.map((it, idx) => (
        <li key={idx} className="flex justify-between items-start gap-2">
          <div className="flex gap-1.5 overflow-hidden">
            <span
              className={`font-bold whitespace-nowrap ${
                dark ? "text-white" : "text-gray-900"
              }`}
            >
              {it.qty}x
            </span>
            <span className="truncate">{it.name}</span>
          </div>
          <div
            className={`font-medium whitespace-nowrap ${
              dark ? "text-white" : "text-gray-900"
            }`}
          >
            S/ {(Number(it.price || 0) * Number(it.qty || 1)).toFixed(2)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function SuccessView({ amount, pedidoNumero, orderSummary, note, onClose }) {
  return (
    <div className="flex flex-col items-center text-center py-6 animate-in fade-in zoom-in">
      <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4">
        <IconCheckCircle />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">¡Pago Exitoso!</h2>
      <p className="text-sm text-gray-500 mb-6">Pedido confirmado.</p>
      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm mb-6 text-left overflow-hidden">
        <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex justify-between">
          <span className="text-xs font-bold text-gray-500">TOTAL</span>
          <span className="text-sm font-bold text-gray-900">
            S/ {Number(amount || 0).toFixed(2)}
          </span>
        </div>
        <div className="p-4">
          {pedidoNumero && (
            <div className="text-sm mb-2 text-gray-900">
              Pedido <b>#{pedidoNumero}</b>
            </div>
          )}
          <OrderSummary orderSummary={orderSummary} />
        </div>
      </div>
      <button
        onClick={onClose}
        className="rounded-full bg-gray-900 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-gray-800 transition-all"
      >
        Finalizar
      </button>
    </div>
  );
}

function CashCreatedView({ amount, pedidoNumero, orderSummary, note, onClose }) {
  return (
    <div className="flex flex-col items-center text-center py-6 animate-in fade-in zoom-in">
      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-4">
        <IconCash />
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Pedido Creado</h2>
      <p className="text-sm text-gray-500 mb-6">
        Paga en caja para finalizar.
      </p>
      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm mb-6 text-left overflow-hidden">
        <div className="bg-amber-50 px-4 py-3 border-b border-amber-100 flex justify-between">
          <span className="text-xs font-bold text-amber-800">POR PAGAR</span>
          <span className="text-sm font-bold text-amber-900">
            S/ {Number(amount || 0).toFixed(2)}
          </span>
        </div>
        <div className="p-4">
          {pedidoNumero && (
            <div className="text-sm mb-2 text-gray-900">
              Pedido <b>#{pedidoNumero}</b>
            </div>
          )}
          <OrderSummary orderSummary={orderSummary} />
        </div>
      </div>
      <button
        onClick={onClose}
        className="rounded-full bg-gray-900 px-8 py-3 text-sm font-bold text-white shadow-lg hover:bg-gray-800 transition-all"
      >
        Entendido
      </button>
    </div>
  );
}

/* ===================== CARD BRICK ===================== */
const CardBrick = React.memo(function CardBrick({
  MP, // compat
  amountSoles,
  intentId,
  restaurantId,
  pedidoId,
  buyerName,
  buyerEmail,
  orderSummary,
  onApproved,
}) {
  const [ready, setReady] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  const idRef = React.useRef(
    `cardPaymentBrick_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  );
  const brickId = idRef.current;

  useEffect(() => {
    let cancelled = false;

    async function initBrick() {
      try {
        setReady(false);
        setErrMsg("");

        const pk =
          window.__MP_INIT_KEY || import.meta.env.VITE_MP_PUBLIC_KEY;
        if (!pk) {
          setErrMsg("Configuración de pago inválida");
          return;
        }

        const MPConstructor = await loadMercadoPagoSdk();
        if (cancelled) return;

        const mp =
          window.__MP_SINGLETON ||
          (window.__MP_SINGLETON = new MPConstructor(pk, {
            locale: "es-PE",
          }));

        const bricksBuilder =
          window.__MP_BRICKS_BUILDER || (window.__MP_BRICKS_BUILDER = mp.bricks());

        if (cardBrickController?.unmount) {
          try {
            await cardBrickController.unmount();
          } catch (e) {
            console.warn("Error desmontando Card Brick previo:", e);
          }
          cardBrickController = null;
        }

        const controller = await bricksBuilder.create("cardPayment", brickId, {
          initialization: {
            amount: Number(amountSoles),
          },
          callbacks: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onError: (error) => {
              console.error("MP Card Brick error:", error);
              if (!cancelled) setErrMsg("Error pago");
            },
            onSubmit: (cardData) =>
              new Promise(async (resolve, reject) => {
                try {
                  const fd = cardData?.formData || cardData;
                  if (!fd?.token) {
                    alert("Completa los datos de la tarjeta");
                    return reject(new Error("Token no generado"));
                  }

                  const items =
                    Array.isArray(orderSummary) && orderSummary.length
                      ? orderSummary.map((it, idx) => ({
                          id: it.id ?? it.itemId ?? `item-${idx + 1}`,
                          name: it.name,
                          title: it.name,
                          descripcion: it.name,
                          category_id:
                            it.category_id || "restaurant_item",
                          qty: Number(it.qty || 1),
                          price: Number(it.price || 0),
                        }))
                      : [];

                  const resp = await payWithCardViaBrick({
                    amount: Number(amountSoles),
                    formData: {
                      token: fd.token,
                      payment_method_id: fd.payment_method_id,
                      issuer_id: fd.issuer_id,
                      installments: Number(fd.installments || 1),
                      payer: {
                        email: fd?.payer?.email || buyerEmail || "",
                        identification: fd?.payer?.identification,
                      },
                    },
                    description: `Pedido ${pedidoId ?? "-"}`,
                    metadata: {
                      intentId,
                      restaurantId,
                      pedidoId,
                      buyer_name: buyerName || "",
                      buyer_email:
                        buyerEmail || fd?.payer?.email || "",
                      items,
                    },
                    idempotencyKey: String(
                      intentId || pedidoId || Date.now()
                    ),
                  });

                  if (resp?.status === "approved") onApproved?.();
                  else alert(`Estado: ${resp?.status}`);

                  resolve(resp);
                } catch (e) {
                  console.error("Error procesando tarjeta:", e);
                  if (!cancelled) setErrMsg("Error procesando tarjeta");
                  reject(e);
                }
              }),
          },
        });

        if (cancelled) {
          try {
            await controller.unmount();
          } catch {}
          return;
        }

        cardBrickController = controller;
      } catch (e) {
        console.error("Error inicializando Card Brick:", e);
        if (!cancelled) setErrMsg("Error pago");
      }
    }

    initBrick();

    return () => {
      cancelled = true;
      if (cardBrickController?.unmount) {
        try {
          cardBrickController.unmount();
        } catch (e) {
          console.warn("Error desmontando Card Brick en cleanup:", e);
        } finally {
          cardBrickController = null;
        }
      }
    };
  }, []); // una sola inicialización por ciclo de vida del CardBrick

  return (
    <div className="w-full min-w-0">
      <div id={brickId} className="w-full" style={{ width: "100%", minWidth: 0 }} />
      {!ready && !errMsg && (
        <div className="flex items-center justify-center h-48 bg-gray-50 rounded-xl border border-dashed border-gray-200 text-xs text-gray-400">
          Cargando tarjeta...
        </div>
      )}
      {!!errMsg && (
        <div className="mt-2 text-xs text-rose-600">{errMsg}</div>
      )}
    </div>
  );
});

/* ===================== LOADER SDK V2 ===================== */
let mpSdkPromise = null;
let cardBrickController = null;

function loadMercadoPagoSdk() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window no disponible"));
  }
  if (window.MercadoPago) {
    return Promise.resolve(window.MercadoPago);
  }
  if (mpSdkPromise) return mpSdkPromise;

  mpSdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src="https://sdk.mercadopago.com/js/v2"]'
    );
    if (existing) {
      existing.addEventListener("load", () =>
        resolve(window.MercadoPago)
      );
      existing.addEventListener("error", (e) => reject(e));
      return;
    }

    const s = document.createElement("script");
    s.src = "https://sdk.mercadopago.com/js/v2";
    s.async = true;
    s.onload = () => resolve(window.MercadoPago);
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });

  return mpSdkPromise;
}

/* ===================== YAPE FORM ===================== */
function YapeForm({
  amountSoles,
  intentId,
  restaurantId,
  pedidoId,
  buyerEmail,
  buyerName,
  orderSummary,
  onApproved,
}) {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const MIN = Number(import.meta.env.VITE_YAPE_MIN ?? 3);
  const amt =
    Number(amountSoles) > 0
      ? Math.round(Number(amountSoles) * 100) / 100
      : 1;
  const belowMin = amt < MIN;

  const submit = async (e) => {
    e.preventDefault();
    if (belowMin) {
      alert(`Mínimo Yape: S/ ${MIN.toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const pk = window.__MP_INIT_KEY;
      await loadMercadoPagoSdk();

      if (!window.MercadoPago || !pk) {
        alert("Error MercadoPago (clave o SDK no disponible).");
        setLoading(false);
        return;
      }

      const mp =
        window.__MP_SINGLETON ||
        (window.__MP_SINGLETON = new window.MercadoPago(pk, {
          locale: "es-PE",
        }));

      const yape = mp.yape({ phoneNumber: phone, otp });
      const { id: token } = await yape.create();

      const items =
        Array.isArray(orderSummary) && orderSummary.length
          ? orderSummary.map((it, idx) => ({
              id: it.id ?? it.itemId ?? `item-${idx + 1}`,
              name: it.name,
              title: it.name,
              descripcion: it.name,
              category_id: it.category_id || "restaurant_item",
              qty: Number(it.qty || 1),
              price: Number(it.price || 0),
            }))
          : [];

      const resp = await payWithYape({
        token,
        amount: amt,
        email: buyerEmail || "yape@temp.com",
        description: `Pedido ${pedidoId}`,
        metadata: {
          intentId,
          restaurantId,
          pedidoId,
          buyer_name: buyerName || "",
          buyer_email: buyerEmail || "",
          items,
        },
        idempotencyKey: String(Date.now()),
      });

      if (resp?.status === "approved") onApproved?.();
      else alert(`Estado: ${resp?.status}`);
    } catch (e) {
      console.error("Error Yape:", e);
      alert("Error Yape");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {belowMin && (
        <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded">
          Mínimo S/ {MIN.toFixed(2)}
        </div>
      )}
      <div className="space-y-3">
        <FloatingInput
          label="Celular"
          value={phone}
          onChange={(v) => setPhone(String(v).replace(/\D+/g, ""))}
          placeholder="9xxxxxxxx"
          inputMode="numeric"
          required
          icon={<span className="text-gray-400 text-lg">📱</span>}
        />
        <FloatingInput
          label="Código de aprobación Yape"
          value={otp}
          onChange={(v) =>
            setOtp(String(v).replace(/\D+/g, "").slice(0, 6))
          }
          placeholder="6 dígitos"
          inputMode="numeric"
          required
          icon={<span className="text-gray-400 text-lg">🔒</span>}
        />
      </div>
      <button
        type="submit"
        disabled={loading || belowMin}
        className="w-full rounded-xl bg-[#742384] py-3.5 text-sm font-bold text-white shadow-lg hover:bg-[#5e1c6b] disabled:opacity-60 transition-all"
      >
        {loading ? "Procesando..." : `Yapear S/ ${amt.toFixed(2)}`}
      </button>
    </form>
  );
}

/* ===================== RESTO HELPERS ===================== */

function Label({ children }) {
  return (
    <label className="mb-1 block text-[11px] font-bold text-gray-500 uppercase tracking-wide ml-1">
      {children}
    </label>
  );
}
function LabeledInput({
  id,
  label,
  value,
  onChange,
  className = "",
  ...rest
}) {
  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <input
        id={id}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 font-medium outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
    </div>
  );
}
function FloatingInput({
  label,
  value,
  onChange,
  className = "",
  icon,
  ...rest
}) {
  return (
    <div className={`relative group ${className}`}>
      <div className="absolute top-3.5 left-4 pointer-events-none z-10">
        {icon}
      </div>
      <input
        className={`peer w-full rounded-2xl border-2 bg-white ${
          icon ? "pl-11" : "pl-4"
        } pr-4 pt-5 pb-2 text-sm font-medium text-gray-900 outline-none border-gray-100 placeholder:text-transparent focus:border-emerald-500 transition-all`}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={label}
        {...rest}
      />
      <label
        className={`pointer-events-none absolute ${
          icon ? "left-11" : "left-4"
        } top-2 text-[10px] font-bold text-gray-400 uppercase transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-500 peer-placeholder-shown:font-normal`}
      >
        {label}
      </label>
    </div>
  );
}
function TogglePill({ active, onClick, children, disabled, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative flex-1 min-w-[120px] rounded-lg font-medium transition-all text-center whitespace-nowrap ${
        small ? "px-2 py-1.5 text-xs" : "px-3 py-2.5 text-sm"
      } ${
        active
          ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5 z-10"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
      } ${disabled ? "opacity-50" : ""}`}
    >
      <span className="flex items-center justify-center">{children}</span>
    </button>
  );
}
function FooterActions({ primaryLabel, primaryDisabled, onCancel }) {
  return (
    <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={primaryDisabled}
        className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-60 transition-all"
      >
        {primaryLabel}
      </button>
    </div>
  );
}
