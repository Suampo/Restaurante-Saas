// src/pages/auth/Checkout.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

// Password temporal simple (recuerda luego hashearlo en el backend/BD)
function genTempPassword(len = 10) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export default function Checkout() {
  const { state } = useLocation(); // { form: { nombre, contacto, telefono, email }, plan }
  const nav = useNavigate();
  const [saving, setSaving] = useState(false);

  const plan = state?.plan || { id: "basic", name: "Básico", price: 300 };
  const restaurantName = state?.form?.nombre;

  const proceed = async () => {
    if (!state?.form?.nombre || !state?.form?.contacto || !state?.form?.email) {
      alert("Completa nombre del restaurante, contacto y email.");
      return;
    }

    try {
      setSaving(true);

      const tempPass = genTempPassword();

      // 👇 Llamamos a TU función RPC para crear restaurante y usuario admin (tenant)
      const { data, error } = await supabase.rpc(
        "register_restaurant_and_admin",
        {
          p_restaurant_name: state.form.nombre,        // nombre del restaurante (tenant)
          p_phone: state.form.telefono ?? null,
          p_contact_name: state.form.contacto,         // nombre del admin
          p_email: state.form.email,
          p_password: tempPass,                        // temporal
          p_role: "admin",
        }
      );

      if (error) {
        console.error(error);
        alert("No se pudo registrar. Revisa que el email no exista y los permisos de la función.");
        return;
      }

      const { user_id, restaurant_id } = (Array.isArray(data) ? data[0] : data) || {};
      if (!user_id || !restaurant_id) {
        alert("Registro incompleto. Verifica la función RPC.");
        return;
      }

      alert(
        `Listo 🎉\nRestaurante (tenant_id): ${restaurant_id}\nUsuario admin: ${user_id}\n(Password temporal: ${tempPass})`
      );

      // Aquí abrirías Culqi. Por ahora, volvemos al inicio:
      nav("/");
    } catch (e) {
      console.error(e);
      alert("Ocurrió un error inesperado.");
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
            {saving ? "Guardando…" : "Continuar a pago (Culqi)"}
          </button>
        </div>

        <p className="mt-4 text-xs text-neutral-500">
          Pagos procesados por Culqi u otra pasarela de pago. Emitimos comprobante al correo registrado.
        </p>
      </div>
    </main>
  );
}
