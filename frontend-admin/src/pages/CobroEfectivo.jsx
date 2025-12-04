// src/pages/CobroEfectivo.jsx
import { useState, useEffect } from "react";
import { getSaldo, crearPagoEfectivo, aprobarPagoEfectivo } from "../services/cashApi";
import {
  Search,
  Loader2,
  Wallet,
  ReceiptText,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Printer,
  Eraser,
} from "lucide-react";

const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export default function CobroEfectivo() {
  // ======= State =======
  const [pedidoId, setPedidoId] = useState("");
  const [saldo, setSaldo] = useState(null); // { total, pagado, pendiente }
  const [loadingSaldo, setLoadingSaldo] = useState(false);

  const [received, setReceived] = useState(""); // cuánto entrega el cliente
  const [amount, setAmount] = useState(""); // cuánto registrar en efectivo
  const [note, setNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [pagoId, setPagoId] = useState(null);

  const [pin, setPin] = useState("");
  const [approving, setApproving] = useState(false);

  const [result, setResult] = useState(null); // { ok, status, ... }
  const [errorMsg, setErrorMsg] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [printable, setPrintable] = useState(null);

  // ======= Helpers =======
  const parseMoney = (v) => {
    const cleaned = (v || "").replace(/,/g, ".").replace(/[^\d.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length > 2) return parts[0] + "." + parts.slice(1).join("");
    if (parts[1]?.length > 2) return parts[0] + "." + parts[1].slice(0, 2);
    return cleaned;
  };

  const calcChangePreview = () => {
    const a = Number(amount || 0);
    const r = Number(received || 0);
    if (!(r > 0) || !(a > 0)) return 0;
    return r > a ? r - a : 0;
  };

  const statusPill = (status) => {
    if (!status) return null;
    const base =
      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium";
    if (status === "paid")
      return (
        <span className={`${base} bg-green-100 text-green-700`}>
          <CheckCircle2 size={14} /> Pagado
        </span>
      );
    if (status === "partial")
      return (
        <span className={`${base} bg-amber-100 text-amber-700`}>
          <AlertCircle size={14} /> Parcial
        </span>
      );
    return (
      <span className={`${base} bg-zinc-100 text-zinc-700`}>
        {String(status).toUpperCase()}
      </span>
    );
  };

  // La sesión viene del login normal (admin/mozo) y del interceptor de FACT_API.
  const ensureSession = async () => {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("dbToken") ||
      sessionStorage.getItem("token") ||
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("dbToken");

    const email = localStorage.getItem("user_email");
    const uid = localStorage.getItem("user_id");
    const rid = localStorage.getItem("restaurant_id");

    // si existe todo → sesión válida
    if (token && email && uid && rid) {
      return true;
    }

    // si falta algo → impedir cobro
    throw new Error("No hay sesión válida. El mozo debe volver a iniciar sesión.");
  };

  // ======= Actions =======
  const fetchSaldo = async (force = false) => {
    if (!pedidoId) return;

    setErrorMsg("");
    setResult(null);
    setPrintable(null);
    setPagoId(null);

    setLoadingSaldo(true);
    try {
      await ensureSession();

      // fuerza a evitar cache agregando timestamp
      const data = await getSaldo(pedidoId, force);

      setSaldo(data);
      setAmount(String(Number(data.pendiente || 0).toFixed(2)));
    } catch (e) {
      setSaldo(null);
      setErrorMsg(
        e?.response?.data?.error || e.message || "No se pudo cargar el saldo"
      );
    } finally {
      setLoadingSaldo(false);
    }
  };

  const handleCrearPago = async () => {
    try {
      setErrorMsg("");
      const a = Number(amount || 0);
      const r = received !== "" ? Number(received || 0) : null;

      if (!(a > 0)) return setErrorMsg("Monto inválido");
      if (saldo && a - Number(saldo.pendiente || 0) > 0.01) {
        return setErrorMsg("El monto excede el saldo pendiente");
      }

      setCreating(true);

      await ensureSession();

      const data = await crearPagoEfectivo(pedidoId, {
        amount: a,
        received: r,
        note,
      });

      // si el backend dice que existe un pago pendiente
      if (data.pendingPaymentId) {
        setPagoId(data.pendingPaymentId);
        setShowPinModal(true);
        return;
      }

      setPagoId(data.pagoId);
      setShowPinModal(true);
    } catch (e) {
      setErrorMsg(
        e?.response?.data?.error || e.message || "No se pudo crear el pago"
      );
    } finally {
      setCreating(false);
    }
  };

  const handleAprobar = async () => {
    try {
      if (!pagoId) return;
      if (!pin || pin.length < 4)
        return setErrorMsg("PIN inválido (mínimo 4 dígitos)");

      setApproving(true);

      await ensureSession();

      const rcv = received !== "" ? Number(received || 0) : null;
      const data = await aprobarPagoEfectivo(pedidoId, pagoId, {
        pin,
        received: rcv,
        note,
      });
      setResult(data);
      setShowPinModal(false);

      const monto = Number(amount || 0);
      const change = rcv != null && rcv > monto ? rcv - monto : 0;

      setPrintable({
        pedidoId,
        total: saldo?.total ?? 0,
        amount: monto,
        received: rcv,
        change,
        status: data?.status,
      });
    } catch (e) {
      setErrorMsg(
        e?.response?.data?.error || e.message || "No se pudo aprobar el pago"
      );
    } finally {
      setApproving(false);
      setTimeout(() => {
        fetchSaldo(true);
      }, 350);
    }
  };

  const onPrint = () => {
    if (!printable) return;
    const w = window.open("", "_blank", "width=380,height=600");
    const html = `
      <html><head><title>Comprobante</title>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial; padding: 16px; }
        h2 { margin: 0 0 8px 0; font-size: 18px; }
        .line { display:flex; justify-content:space-between; margin:6px 0; font-size: 14px; }
        .ok { color: #16a34a; font-weight: 700; }
        .muted { color: #6b7280; }
        hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
      </style>
      </head>
      <body>
        <h2>Pago en efectivo</h2>
        <div class="line"><span class="muted">Pedido</span><span>#${printable.pedidoId}</span></div>
        <div class="line"><span class="muted">Total</span><span>${PEN.format(
          printable.total
        )}</span></div>
        <div class="line"><span class="muted">Registrado efectivo</span><span>${PEN.format(
          printable.amount
        )}</span></div>
        <div class="line"><span class="muted">Recibido</span><span>${
          printable.received != null ? PEN.format(printable.received) : "-"
        }</span></div>
        <div class="line"><span class="muted">Vuelto</span><span>${PEN.format(
          printable.change || 0
        )}</span></div>
        <div class="line"><span class="muted">Estado</span><span class="ok">${String(
          printable.status || ""
        ).toUpperCase()}</span></div>
        <hr />
        <small class="muted">Gracias por su compra</small>
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    setTimeout(() => w.close(), 300);
  };

  const clearAll = () => {
    setPedidoId("");
    setSaldo(null);
    setReceived("");
    setAmount("");
    setNote("");
    setPagoId(null);
    setPin("");
    setResult(null);
    setPrintable(null);
    setErrorMsg("");
  };

  // ======= Autofill desde QR (?pedido=) =======
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pid = q.get("pedido");
    if (pid) {
      setPedidoId(pid);
      setTimeout(() => {
        fetchSaldo();
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ======= UI =======
  return (
    <div className="mx-auto w-full max-w-5xl p-3 sm:p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Wallet className="h-6 w-6 text-green-600" />
        <h1 className="text-xl font-semibold sm:text-2xl">
          Cobro en efectivo (Mozo)
        </h1>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
          {errorMsg}
        </div>
      )}
      {result?.ok && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
          <div>
            <div className="font-medium">Pago registrado correctamente</div>
            {statusPill(result?.status)}
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Columna izquierda */}
        <div className="space-y-4">
          {/* Buscar pedido */}
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Search className="h-5 w-5 text-zinc-500" />
              <div className="font-medium">Buscar pedido</div>
            </div>
            <div className="px-4 pb-4 pt-3">
              <label className="mb-1 block text-sm text-zinc-600">
                Pedido ID
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={pedidoId}
                  onChange={(e) =>
                    setPedidoId(e.target.value.replace(/\D+/g, ""))
                  }
                  onKeyDown={(e) => e.key === "Enter" && fetchSaldo()}
                  placeholder="Ej: 123"
                  inputMode="numeric"
                  className="w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring-2"
                />
                <button
                  onClick={fetchSaldo}
                  disabled={!pedidoId || loadingSaldo}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {loadingSaldo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  {loadingSaldo ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
          </div>

          {/* Formulario de cobro */}
          <div
            className={`rounded-2xl border bg-white shadow-sm ${
              !saldo ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <ReceiptText className="h-5 w-5 text-zinc-500" />
              <div className="font-medium">Registrar pago en efectivo</div>
            </div>

            <div className="px-4 pb-4 pt-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-zinc-600">
                    Recibido (cliente)
                  </label>
                  <input
                    value={received}
                    onChange={(e) => setReceived(parseMoney(e.target.value))}
                    placeholder="Ej: 50.00"
                    inputMode="decimal"
                    className="w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring-2"
                    disabled={!saldo}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="mb-1 block text-sm text-zinc-600">
                      Registrar efectivo (amount)
                    </label>
                    {saldo && (
                      <button
                        type="button"
                        onClick={() =>
                          setAmount(
                            String(Number(saldo.pendiente || 0).toFixed(2))
                          )
                        }
                        className="text-xs text-emerald-700 hover:underline"
                      >
                        Usar pendiente
                      </button>
                    )}
                  </div>
                  <input
                    value={amount}
                    onChange={(e) => setAmount(parseMoney(e.target.value))}
                    placeholder={`Ej: ${
                      saldo
                        ? Number(saldo.pendiente || 0).toFixed(2)
                        : "0.00"
                    }`}
                    inputMode="decimal"
                    className="w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring-2"
                    disabled={!saldo}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm text-zinc-600">
                    Observación (opcional)
                  </label>
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={250}
                    placeholder="Ej: billete S/100 - mesa 12"
                    className="w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring-2"
                    disabled={!saldo}
                  />
                </div>
              </div>

              {/* Vuelto + acciones */}
              <div className="mt-3 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                <div className="text-sm">
                  <span className="text-zinc-500">Vuelto (previo): </span>
                  <strong>{PEN.format(calcChangePreview())}</strong>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleCrearPago}
                    disabled={
                      !saldo ||
                      creating ||
                      !amount ||
                      Number(amount) <= 0 ||
                      (saldo &&
                        Number(amount) - Number(saldo.pendiente) > 0.01)
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    {creating ? "Registrando..." : "Registrar efectivo"}
                  </button>

                  <button
                    onClick={clearAll}
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    <Eraser className="h-4 w-4" /> Limpiar
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Resultado + impresión */}
          {result && (
            <div className="rounded-2xl border bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <div className="font-medium">Resultado</div>
                <div className="ml-auto">{statusPill(result?.status)}</div>
              </div>
              <div className="px-4 pb-4 pt-3">
                <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800">
                  {JSON.stringify(result, null, 2)}
                </pre>
                {printable?.status && (
                  <button
                    onClick={onPrint}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800"
                  >
                    <Printer className="h-4 w-4" /> Imprimir comprobante
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha (resumen) */}
        <div className="space-y-4">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <KeyRound className="h-5 w-5 text-zinc-500" />
              <div className="font-medium">Resumen de pedido</div>
            </div>
            <div className="px-4 pb-4 pt-3">
              {!saldo ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-zinc-500">
                  Busca un pedido para ver su detalle.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Total</div>
                    <div className="text-lg font-semibold">
                      {PEN.format(saldo.total)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Pagado</div>
                    <div className="text-lg font-semibold">
                      {PEN.format(saldo.pagado)}
                    </div>
                  </div>
                  <div className="rounded-xl bg-zinc-50 p-3">
                    <div className="text-xs text-zinc-500">Pendiente</div>
                    <div className="text-lg font-semibold text-amber-600">
                      {PEN.format(saldo.pendiente)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 font-medium">Ayuda rápida</div>
            <div className="space-y-2 px-4 pb-4 pt-3 text-sm text-zinc-600">
              <p>
                • Usa <b>“Usar pendiente”</b> para llenar el monto exacto que
                falta.
              </p>
              <p>
                • El <b>PIN</b> lo define el restaurante; si no existe, el
                sistema te avisará.
              </p>
              <p>
                • Tras aprobar, si el estado queda <b>Parcial</b>, aún falta
                saldo para completar el pago.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal PIN */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3">
          <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <KeyRound className="h-5 w-5 text-zinc-500" />
              <div className="font-medium">Aprobar con PIN</div>
            </div>
            <div className="px-4 pb-4 pt-3">
              <input
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D+/g, "").slice(0, 6))
                }
                placeholder="PIN (4-6 dígitos)"
                inputMode="numeric"
                className="mb-3 w-full rounded-lg border px-3 py-2 outline-none ring-emerald-200 focus:ring-2"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowPinModal(false)}
                  className="rounded-lg border px-4 py-2 font-medium hover:bg-zinc-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAprobar}
                  disabled={approving || !pin || pin.length < 4}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {approving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {approving ? "Aprobando..." : "Aprobar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
