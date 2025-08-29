// src/pages/auth/Checkout.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { prepareCheckout } from "../../lib/api";
import ComprobanteModal from "./components/ComprobanteModal.jsx";

export default function Checkout() {
  const { state } = useLocation(); // { form: { nombre, contacto, telefono, email }, plan }
  const nav = useNavigate();

  // Rehidratación si recargan la página
  const form = useMemo(() => {
    if (state?.form) return state.form;
    const saved = sessionStorage.getItem("registro_restaurante");
    return saved ? JSON.parse(saved) : null;
  }, [state]);

  const plan = useMemo(() => {
    if (state?.plan) return state.plan;
    const saved = sessionStorage.getItem("plan");
    return saved ? JSON.parse(saved) : { id: "basic", name: "Básico", price: 300 };
  }, [state]);

  const restaurantName = form?.nombre || "—";

  const [saving, setSaving] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  useEffect(() => {
    if (!form) nav("/registro");
  }, [form, nav]);

  if (!form) return null;

  const proceed = () => setOpenModal(true);

  // Confirmación del modal → crear orden y abrir Culqi / redirigir
  const onConfirmModal = async ({ docType, customer }) => {
    setOpenModal(false);
    try {
      setSaving(true);

      const payload = {
        planId: plan.id,
        amount: Math.round(Number(plan.price) * 100), // céntimos
        currency: "PEN",
        restaurant: { id: null, name: restaurantName },
        docType, // "01"=Factura, "03"=Boleta
        customer: {
          email: customer.email,
          phone: customer.phone,
          fullName: customer.fullName,
          dni: customer.dni || "",
          ruc: customer.ruc || "",
          razonSocial: customer.razonSocial || "",
          direccionFiscal: customer.direccionFiscal || "",
        },
      };

      const data = await prepareCheckout(payload);

      // Opción A: Link de pago (si tu backend decide usarlo)
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Opción B: Custom Checkout con checkout-js
      if (data?.culqi?.orderId && window.Culqi) {
        const publicKey = import.meta.env.VITE_CULQI_PUBLIC_KEY;
        const amount    = Number(payload.amount);   // céntimos
        const currency  = payload.currency || "PEN";
        const orderId   = data.culqi.orderId;

        // 1) Configurar Culqi
        window.Culqi.publicKey = publicKey;
        // ¡OJO! settings es una FUNCIÓN, no un objeto:
        window.Culqi.settings({
          title: "MikhunApp",
          currency,
          amount,
          order: orderId,
        });

        // 2) Callback global
        window.culqi = function () {
          if (window.Culqi?.order) {
            console.log("Order:", window.Culqi.order);
            alert("Procesando pago… te avisaremos por correo.");
          } else if (window.Culqi?.token) {
            console.log("Token:", window.Culqi.token.id);
          } else if (window.Culqi?.error) {
            console.warn("Culqi error:", window.Culqi.error);
            alert(window.Culqi.error?.user_message || "Error en el pago");
          }
        };

        // 3) Abrir modal
        window.Culqi.open();
        return;
      }

      alert("No se pudo iniciar el pago. Revisa la configuración del backend.");
    } catch (e) {
      console.error(e);
      alert("Error iniciando el pago.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="py-12">
      <div className="mx-auto max-w-xl px-4">
        <h1 className="text-2xl font-bold">Pago de suscripción</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Revisa tu pedido antes de continuar al pago.
        </p>

        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Plan {plan.name}</div>
              <div className="text-sm text-neutral-600">Renovación mensual</div>
            </div>
            <div className="text-2xl font-bold">S/ {plan.price}</div>
          </div>

          {restaurantName && (
            <div className="mt-4 text-sm">
              <div className="font-semibold">Restaurante</div>
              <div className="text-neutral-700">{restaurantName}</div>
            </div>
          )}

          <button
            onClick={proceed}
            disabled={saving}
            className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "Procesando…" : "Continuar a pago (Culqi)"}
          </button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Pagos procesados por Culqi. Emitimos comprobante al correo registrado.
        </p>
      </div>

      <ComprobanteModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onConfirm={onConfirmModal}
        prefill={form}
      />
    </main>
  );
}
