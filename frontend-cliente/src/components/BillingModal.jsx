// src/components/BillingModal.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { payWithCardViaBrick, payWithYape } from "../services/mercadopago";
import { useMenuPublic } from "../hooks/useMenuPublic";
import { abandonarIntent } from "../services/checkout";

/* ===================== ICONS (inline, sin dependencias) ===================== */
const IconCard = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}><path fill="currentColor" d="M3 7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7zm3-1a1 1 0 0 0-1 1v1h14V7a1 1 0 0 0-1-1H6zm13 5H5v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6zM7 16h4a1 1 0 1 1 0 2H7a1 1 0 1 1 0-2z"/></svg>
);
const IconYape = (p) => (
  <svg viewBox="0 0 24 24" width="16" height="16" {...p}><path fill="currentColor" d="M17 2H7a3 3 0 0 0-3 3v14l4-3h9a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3z"/></svg>
);
const IconLock = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" {...p}><path fill="currentColor" d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg>
);

/* ===================== MODAL ===================== */
export default function BillingModal({
  open,
  onClose,
  loading = false,
  onSubmit,          // crea/actualiza la INTENT + PEDIDO
  MP,                // { Payment, CardPayment } desde @mercadopago/sdk-react
  showCard = false,
  orderInfo = null,  // { intentId, amount (SOLES), restaurantId, pedidoId?, email? }
  onBackToForm,
  orderSummary = [],
  orderNote = "",
}) {
  const { billingMode } = useMenuPublic();
  const isSunat = billingMode === "sunat";

  // comunes
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  // sunat
  const [comprobante, setComprobante] = useState("boleta");
  const [docType, setDocType] = useState("DNI");
  const [docNumber, setDocNumber] = useState("");
  const [address, setAddress] = useState("");

  // estados UI
  const [success, setSuccess] = useState(null); // { amount, pedidoId }
  const [processing, setProcessing] = useState(false);

  const amountSoles = useMemo(
    () => Math.max(1, Number(orderInfo?.amount || 0)), // asegura número > 0
    [orderInfo?.amount]
  );

  useEffect(() => {
    if (!open) {
      setSuccess(null);
      setProcessing(false);
    }
  }, [open]);

  if (!open) return null;

  const submitForm = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      if (!isSunat) {
        await onSubmit?.({ mode: "nosunat", email, name });
        return;
      }
      await onSubmit?.({ mode: "sunat", comprobante, docType, docNumber, name, address, email });
    } finally {
      setProcessing(false);
    }
  };

  const handleHeaderClose = async () => {
   // ⛔️ No anular si ya se pagó
   if (showCard && orderInfo?.intentId && !success) {
      try { await abandonarIntent(orderInfo.intentId); } catch {}
    }
    onClose?.();
  };

  const showSuccess = (amount) => {
    setSuccess({
      amount: Number(amount || amountSoles || 0),
      pedidoId: orderInfo?.pedidoId || orderInfo?.pedido_id || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 sm:p-6"
      style={{ background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35))" }}
      role="dialog"
      aria-modal="true"
    >
      <div className="
        w-full max-w-[560px] sm:max-w-5xl overflow-hidden
        rounded-3xl border border-white/10 bg-white/80 backdrop-blur-xl
        shadow-[0_10px_40px_-5px_rgba(0,0,0,.25)]
        ring-1 ring-black/5 max-h-[92svh] flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 shrink-0 bg-gradient-to-r from-white/70 to-white/40 backdrop-blur">
          <h2 className="text-base sm:text-lg font-semibold tracking-tight text-neutral-900" id="billing-title">
            {success ? "Pago recibido" : showCard ? "Pago seguro" : isSunat ? "Datos para Boleta/Factura" : "Datos del cliente (opcional)"}
          </h2>
          <button
            type="button"
            className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            onClick={handleHeaderClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3 sm:p-6" aria-labelledby="billing-title">
          {success ? (
            <SuccessView
              amount={success.amount}
              pedidoId={success.pedidoId}
              orderSummary={orderSummary}
              note={orderNote}
              onClose={onClose}
            />
          ) : showCard && orderInfo ? (
            <PayTabs
              MP={MP}
              amountSoles={amountSoles}
              orderInfo={orderInfo}
              onBackToForm={async () => {
   if (!success && orderInfo?.intentId) { try { await abandonarIntent(orderInfo.intentId); } catch {} }
   onBackToForm?.();
 }}
 onClose={handleHeaderClose}
              orderSummary={orderSummary}
              onMpApproved={() => showSuccess(amountSoles)}
            />
          ) : (
            <form onSubmit={submitForm} noValidate>
              {!isSunat ? (
                <>
                  <div className="space-y-3">
                    <LabeledInput id="billing-name" label="Nombre (opcional)" value={name} onChange={setName} placeholder="Cliente" />
                    <LabeledInput id="billing-email" label="Email (opcional)" type="email" value={email} onChange={setEmail} placeholder="cliente@correo.com" />
                  </div>
                  <FooterActions
                    primaryLabel={loading || processing ? "Procesando…" : "Continuar a pagar"}
                    primaryDisabled={loading || processing}
                    onCancel={onClose}
                  />
                </>
              ) : (
                <>
                  {/* Selector Boleta/Factura */}
                  <div className="mb-3 inline-flex rounded-full bg-neutral-100 p-1 ring-1 ring-black/5">
                    <TogglePill active={comprobante === "boleta"} onClick={() => { setComprobante("boleta"); if (docType !== "DNI") setDocType("DNI"); }}>Boleta</TogglePill>
                    <TogglePill active={comprobante === "factura"} onClick={() => { setComprobante("factura"); setDocType("RUC"); }}>Factura</TogglePill>
                  </div>

                  {/* Tarjeta del formulario */}
                  <div className="rounded-2xl border bg-white/80 backdrop-blur shadow-sm ring-1 ring-black/5">
                    <div className="grid gap-3 p-4 sm:grid-cols-3">
                      <div>
                        <Label small>Tipo doc.</Label>
                        <select
                          id="billing-docType"
                          name="no-autofill-doctype"
                          autoComplete="off"
                          className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-neutral-900 outline-none ring-0 transition placeholder:text-neutral-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-neutral-50"
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                          disabled={comprobante === "factura"}
                        >
                          <option value="DNI">DNI</option>
                          <option value="RUC">RUC</option>
                        </select>
                      </div>

                      <LabeledInput
                        id="billing-docNumber"
                        className="sm:col-span-2"
                        label={docType === "RUC" ? "RUC" : "DNI"}
                        value={docNumber}
                        onChange={(v) => setDocNumber(v.replace(/\D+/g, "").slice(0, docType === "RUC" ? 11 : 8))}
                        placeholder={docType === "RUC" ? "11 dígitos" : "8 dígitos"}
                        inputMode="numeric"
                        required
                      />

                      <LabeledInput
                        id="billing-name-sunat"
                        className="sm:col-span-3"
                        label={docType === "RUC" ? "Razón Social" : "Nombres y Apellidos"}
                        value={name}
                        onChange={setName}
                        placeholder={docType === "RUC" ? "Mi Empresa S.A.C." : "Juan Pérez"}
                        required
                      />

                      <LabeledInput
                        id="billing-address"
                        className="sm:col-span-3"
                        label={<>Dirección <span className="text-neutral-400">(opcional)</span></>}
                        value={address}
                        onChange={setAddress}
                        placeholder="Av. Principal 123"
                      />

                      <div className="sm:col-span-3">
                        <LabeledInput
                          id="billing-email-sunat"
                          type="email"
                          label={<>Email <span className="text-neutral-400">(opcional)</span></>}
                          value={email}
                          onChange={setEmail}
                          placeholder="cliente@correo.com"
                        />
                        <p className="mt-1 text-[11px] text-neutral-500">Lo usamos para enviarte el comprobante.</p>
                      </div>
                    </div>
                  </div>

                  <FooterActions
                    primaryLabel={loading || processing ? "Procesando…" : "Continuar a pagar"}
                    primaryDisabled={loading || processing}
                    onCancel={onClose}
                  />
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== PAY TABS ===================== */
function PayTabs({
  MP,
  amountSoles,
  orderInfo,     // { intentId, restaurantId, pedidoId?, email? }
  onBackToForm,
  onClose,
  orderSummary,
  onMpApproved,
}) {
  const [tab, _setTab] = useState("card"); // 'card' | 'yape'
  const [switching, setSwitching] = useState(false);
  const setTab = (t) => {
    if (switching || t === tab) return;
    _setTab(t);
    setSwitching(true);
    setTimeout(() => setSwitching(false), 350);
  };

  const totalRight = (
    <div className="rounded-2xl border bg-white/80 backdrop-blur p-4 shadow-sm ring-1 ring-black/5">
      <div className="text-sm text-neutral-600">Total a pagar</div>
      <div className="mt-1 text-3xl font-extrabold text-neutral-900">S/ {amountSoles.toFixed(2)}</div>
      <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
        <IconLock className="opacity-70" /> Procesado por Mercado Pago
      </div>
      <div className="mt-2 inline-block rounded-md bg-neutral-100 px-2 py-1 text-xs text-neutral-700">
        Intent #{String(orderInfo?.intentId || "").slice(0, 8)}
      </div>
    </div>
  );

  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      {/* IZQUIERDA */}
      <section>
        {/* Tabs */}
        <div className="inline-flex rounded-full bg-neutral-100 p-1 ring-1 ring-black/5">
          <TogglePill active={tab === "card"} onClick={() => setTab("card")}>
            <span className="mr-1.5 inline-flex"><IconCard /></span>Tarjeta
          </TogglePill>
          <TogglePill active={tab === "yape"} onClick={() => setTab("yape")}>
            <span className="mr-1.5 inline-flex"><IconYape /></span>Yape
          </TogglePill>
        </div>

        <div className="mt-4 rounded-2xl border bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
          {/* Card tab */}
          {tab === "card" && (
            <div className={`transition-all ${switching ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <h3 className="mb-3 text-sm font-medium text-neutral-900">Tarjeta de crédito o débito</h3>
              <div className="mp-card-wrap min-h-[320px]">
                <CardBrick
                  MP={MP}
                  amountSoles={amountSoles}
                  intentId={orderInfo?.intentId}
                  restaurantId={orderInfo?.restaurantId}
                  pedidoId={orderInfo?.pedidoId}
                  onApproved={() => onMpApproved?.()}
                />
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">Pago seguro con campos protegidos.</p>
            </div>
          )}

          {/* Yape (form + tokenización) */}
          {tab === "yape" && (
            <div className={`transition-all ${switching ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"}`}>
              <h3 className="mb-3 text-sm font-medium text-neutral-900">Pagar con Yape</h3>
              <YapeForm
                amountSoles={amountSoles}
                intentId={orderInfo?.intentId}
                restaurantId={orderInfo?.restaurantId}
                pedidoId={orderInfo?.pedidoId}
                buyerEmail={orderInfo?.email}
                onApproved={() => onMpApproved?.()}
              />
            </div>
          )}
        </div>

        {/* Footer acciones izquierda */}
        <div className="sticky bottom-0 mt-3 -mx-4 border-t bg-white/95 px-4 py-3 md:static md:m-0 md:border-0 md:bg-transparent md:p-0">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToForm}
              className="rounded-lg border px-4 py-2 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              ← Volver a datos
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
            >
              Cerrar
            </button>
          </div>
        </div>

        {/* En móvil: total + resumen */}
        <div className="mt-3 md:hidden">
          <details className="rounded-2xl border bg-white/80 shadow-sm ring-1 ring-black/5">
            <summary className="cursor-pointer list-none px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">Total a pagar</span>
                <span className="text-xl font-extrabold text-neutral-900">S/ {amountSoles.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-neutral-500">Toca para ver el resumen</div>
            </summary>
            <div className="border-t p-4">
              <OrderSummary orderSummary={orderSummary} />
            </div>
          </details>
        </div>
      </section>

      {/* DERECHA */}
      <aside className="hidden space-y-4 md:block">
        {totalRight}
        <div className="rounded-2xl border bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
          <h4 className="mb-2 text-sm font-medium text-neutral-900">Resumen del pedido</h4>
          <OrderSummary orderSummary={orderSummary} />
        </div>
      </aside>
    </div>
  );
}

/* ===================== PIEZAS ===================== */
function OrderSummary({ orderSummary }) {
  if (!Array.isArray(orderSummary) || orderSummary.length === 0) {
    return <div className="text-sm text-neutral-600">Sin ítems.</div>;
  }
  return (
    <ul className="divide-y text-sm">
      {orderSummary.map((it, idx) => (
        <li key={idx} className="flex items-center justify-between py-2">
          <div className="flex-1">
            <div className="font-medium text-neutral-900">{it.name}</div>
            <div className="text-xs text-neutral-500">x{it.qty}</div>
          </div>
          <div className="ml-3 text-right text-neutral-900">
            S/ {(Number(it.price || 0) * Number(it.qty || 1)).toFixed(2)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ===================== CARD BRICK ===================== */
const CardBrick = React.memo(function CardBrick({
  MP,
  amountSoles,
  intentId,
  restaurantId,
  pedidoId,
  onApproved,
}) {
  const PaymentCmp = MP?.CardPayment;
  const wrapRef = useRef(null);
  const unmounted = useRef(false);

  const [reloadKey, setReloadKey] = useState(0);
  const brickKey = useMemo(
    () => `intent-${intentId}-amt-${amountSoles}-rel${reloadKey}`,
    [intentId, amountSoles, reloadKey]
  );

  // Sólo montamos cuando el contenedor está visible y con tamaño > mínimo
  const [canMount, setCanMount] = useState(false);
  useEffect(() => {
    if (!wrapRef.current) return;
    let ready = false;
    let timer = null;
    const MIN_W = 260, MIN_H = 200;

    const check = (rect, visible) => {
      const ok = visible && rect.width >= MIN_W && rect.height >= MIN_H;
      if (ok && !ready) {
        timer = setTimeout(() => { if (!unmounted.current) { ready = true; setCanMount(true); } }, 250);
      } else if (!ok) {
        if (timer) clearTimeout(timer);
        if (ready) { ready = false; setCanMount(false); }
      }
    };

    const ro = new ResizeObserver(() => {
      const el = wrapRef.current; if (!el) return;
      const rect = el.getBoundingClientRect();
      const visible = !!(el.offsetParent !== null || rect.width || rect.height);
      check(rect, visible);
    });
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0]; const el = wrapRef.current; if (!el) return;
      const rect = el.getBoundingClientRect(); check(rect, entry && entry.isIntersecting);
    }, { threshold: 0.05 });

    ro.observe(wrapRef.current); io.observe(wrapRef.current);
    const el = wrapRef.current; if (el) { const rect = el.getBoundingClientRect(); check(rect, true); }
    return () => { if (timer) clearTimeout(timer); ro.disconnect(); io.disconnect(); };
  }, [reloadKey]);
  useEffect(() => () => { unmounted.current = true; }, []);

  const [brickError, setBrickError] = useState(null);
  if (!PaymentCmp) {
    return <div className="rounded-lg border bg-white p-3 text-sm text-rose-700">No se pudo cargar el formulario de pago.</div>;
  }

 const handleSubmit = (cardData) =>
  new Promise(async (resolve, reject) => {
    try {
      // En algunas versiones viene como { formData }, en otras viene plano.
      const fd = cardData?.formData || cardData;

      if (!fd?.token) {
        console.warn("[CardPayment] formData sin token:", fd);
        alert("Completa los datos de la tarjeta");
        return reject(new Error("Token no generado por el Brick"));
      }

      const resp = await payWithCardViaBrick({
        amount: Number(amountSoles),
        formData: {
          token: fd.token,
          payment_method_id: fd.payment_method_id,
          issuer_id: fd.issuer_id,
          installments: Number(fd.installments || 1),
          payer: {
            // usa lo que devuelva el brick, y pon un fallback por si acaso
            email: fd?.payer?.email || "",
            identification: fd?.payer?.identification,
          },
        },
        description: `Pedido ${pedidoId ?? "-"} / Intent ${intentId}`,
        metadata: { intentId, restaurantId, pedidoId },
        idempotencyKey: String(intentId || pedidoId),
      });

      if (resp?.status === "approved") onApproved?.();
      else alert(`Estado: ${resp?.status} (${resp?.status_detail || ""})`);
      resolve(resp);
    } catch (e) {
      console.error("CardPayment submit error:", e);
      alert("Error procesando tarjeta");
      reject(e);
    }
  });
  const handleError = (e) => {
    if (unmounted.current) return;
    console.error("CardPayment Brick error:", e);
    setBrickError(e || { type: "critical", cause: "unknown" });
  };

  const containerId = `cardPaymentBrick_container_${brickKey}`;

  return (
    <div ref={wrapRef} className="min-h-[320px]">
      {!canMount && !brickError && (
        <div className="rounded-lg border bg-white p-3 text-sm text-neutral-600">Cargando formulario de pago…</div>
      )}

      {brickError ? (
        <div className="rounded-lg border bg-white p-4 text-sm">
          <div className="mb-2 font-medium text-rose-700">No se pudo inicializar el formulario seguro.</div>
          <div className="text-neutral-700">
            {String(brickError.cause || "").includes("fields_setup_failed")
              ? "El contenedor pudo estar oculto o el navegador bloqueó iframes de terceros."
              : "Ha ocurrido un problema al cargar el formulario de pago."}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-neutral-50"
              onClick={() => { setBrickError(null); setCanMount(false); setTimeout(() => setReloadKey((k) => k + 1), 350); }}
            >
              Reintentar
            </button>
            <a href="https://www.whatismybrowser.com/detect/is-javascript-enabled" target="_blank" rel="noreferrer" className="text-xs text-neutral-500 underline">
              Consejos (bloqueadores/JS)
            </a>
          </div>
        </div>
      ) : canMount ? (
        <>
          <div id={containerId} />
          <PaymentCmp
            key={brickKey}
            containerProps={{ id: containerId }}
            initialization={{ amount: Number(amountSoles) }}
            onSubmit={handleSubmit}
            onError={handleError}
            onReady={() => console.log("CardPayment Brick listo")}
          />
        </>
      ) : null}
    </div>
  );
});

/* ===================== YAPE FORM (tokenización) ===================== */
function YapeForm({ amountSoles, intentId, restaurantId, pedidoId, buyerEmail, onApproved }) {
  const [phone, setPhone] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const MIN = Number(import.meta.env.VITE_YAPE_MIN ?? 3);
  const raw = Number(amountSoles);
  const amt = Number.isFinite(raw) && raw > 0 ? Math.round(raw * 100) / 100 : 1;
  const belowMin = amt < MIN;

  const submit = async (e) => {
    e.preventDefault();
    if (belowMin) {
      alert(`El mínimo para Yape es S/ ${MIN.toFixed(2)}`);
      return;
    }
    setLoading(true);
    try {
      const pk = window.__MP_INIT_KEY;
      const mp = new window.MercadoPago(pk, { locale: "es-PE" });
      const yape = mp.yape({ phoneNumber: phone, otp });
      const { id: token } = await yape.create();

      const safeEmail = (buyerEmail || "").trim() || `yape+${intentId || Date.now()}@example.com`;

      console.log("[YapeForm] monto enviado:", amt);

      const resp = await payWithYape({
        token,
        amount: amt,
        email: safeEmail,
        description: `Intent ${intentId}`,
        metadata: { intentId, restaurantId, pedidoId },
        idempotencyKey: String(intentId || pedidoId || Date.now()),
      });

      if (resp?.status === "approved") onApproved?.();
      else alert(`Estado: ${resp?.status} (${resp?.status_detail || ""})`);
    } catch (err) {
      console.error("YapeForm error:", err);
      alert("No se pudo tokenizar Yape");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 text-neutral-900">
      {/* aviso mínimo */}
      {belowMin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
          El monto mínimo para Yape es <b>S/ {MIN.toFixed(2)}</b>.
        </div>
      )}

      <FloatingInput
        label="Celular"
        value={phone}
        onChange={(v) => setPhone(String(v).replace(/\D+/g, ""))}
        placeholder="9xxxxxxxx"
        inputMode="numeric"
        required
      />
      <FloatingInput
        label="OTP (6 dígitos)"
        value={otp}
        onChange={(v) => setOtp(String(v).replace(/\D+/g, "").slice(0, 6))}
        placeholder="Código de Yape"
        inputMode="numeric"
        required
      />

      <button
        type="submit"
        disabled={loading || belowMin}
        className="group inline-flex items-center justify-center rounded-xl
                   bg-gradient-to-t from-emerald-600 to-emerald-500 px-4 py-2
                   text-sm font-semibold text-white shadow-sm ring-1 ring-emerald-700/20
                   transition hover:from-emerald-500 hover:to-emerald-400
                   disabled:opacity-60"
      >
        <span className="mr-2 inline-flex"><IconYape /></span>
        {loading ? "Procesando…" : "Pagar con Yape"}
      </button>

      <p className="text-[12px] text-neutral-600">
        Se cobrará <b>S/ {amt.toFixed(2)}</b> vía Yape.
      </p>
    </form>
  );
}

/* ===================== SUCCESS ===================== */
function SuccessView({ amount, pedidoId, orderSummary, note, onClose }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <div className="font-semibold text-emerald-900">¡Gracias por tu compra!</div>
        {pedidoId ? <div className="text-sm">Pedido #{pedidoId}</div> : null}
      </div>

      <div className="rounded-2xl border bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
        <div className="text-sm text-neutral-600">Total pagado</div>
        <div className="mt-1 text-3xl font-extrabold text-neutral-900">S/ {Number(amount || 0).toFixed(2)}</div>
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-600"><IconLock /> Procesado por Mercado Pago</div>
      </div>

      <div className="rounded-2xl border bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
        <h4 className="mb-2 text-sm font-medium text-neutral-900">Resumen del pedido</h4>
        {(!orderSummary || orderSummary.length === 0) ? (
          <div className="text-sm text-neutral-600">Sin ítems.</div>
        ) : (
          <OrderSummary orderSummary={orderSummary} />
        )}

        {note ? (
          <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-700">
            <div className="mb-1 font-medium text-neutral-900">Nota para cocina</div>
            <div>{note}</div>
          </div>
        ) : null}
      </div>

      <div className="text-right">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-neutral-800"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/* ===================== UI ATOMS ===================== */
function Label({ children, small }) {
  return <label className={`${small ? "text-[12px]" : "text-xs"} mb-1 block font-medium text-neutral-600`}>{children}</label>;
}

function LabeledInput({ id, label, value, onChange, className = "", ...rest }) {
  return (
    <div className={className}>
      {label ? <Label>{label}</Label> : null}
      <input
        id={id}
        name={`no-autofill-${id}`}
        autoComplete="off"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5
                   text-neutral-900 outline-none transition placeholder:text-neutral-400
                   focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      />
    </div>
  );
}

/* Floating style input para el formulario Yape */
function FloatingInput({ label, value, onChange, className = "", ...rest }) {
  const active = String(value || "").length > 0;
  return (
    <div className={`relative ${className}`}>
      <input
        className={`peer w-full rounded-xl border bg-white px-3.5 pt-5 pb-2.5 text-[15px]
                    text-neutral-900 outline-none transition
                    border-neutral-300 placeholder:text-transparent
                    focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100`}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={label}
        {...rest}
      />
      <label
        className={`pointer-events-none absolute left-3.5 top-2
                    text-[11px] font-medium transition
                    ${active ? "text-neutral-600" : "text-neutral-500 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[14px]"}`}
      >
        {label}
      </label>
    </div>
  );
}

function TogglePill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative rounded-full px-4 py-1.5 text-sm font-medium transition
        ${active
          ? "bg-white shadow-sm text-neutral-900"
          : "text-neutral-700 hover:bg-white/70"}`}
    >
      <span
        className={`absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-emerald-500/0 to-emerald-500/0 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
      />
      {children}
    </button>
  );
}

function FooterActions({ primaryLabel, primaryDisabled, onCancel }) {
  return (
    <div className="sticky bottom-0 mt-4 -mx-4 border-t bg-white/95 px-4 py-3 sm:mx-0 sm:px-0">
      <div className="flex items-center justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm text-neutral-700 shadow-sm hover:bg-neutral-50">
          Cancelar
        </button>
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60" disabled={primaryDisabled}>
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
