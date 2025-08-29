// src/pages/auth/PlanSelection.jsx
import { useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";

export default function PlanSelection() {
  const { state } = useLocation(); // { form }
  const nav = useNavigate();

  useEffect(() => {
    if (!state?.form) {
      // intenta recuperar del sessionStorage
      const reg = JSON.parse(sessionStorage.getItem("registro_restaurante") || "null");
      if (reg) {
        nav("/registro/planes", { state: { form: reg } }); // rehidrata y queda
      } else {
        nav("/registro");
      }
    }
  }, [state, nav]);

  if (!state?.form) return null;

  const chooseBasic = () => {
    const plan = { id: "basic", name: "Básico", price: 300 };
    sessionStorage.setItem("plan", JSON.stringify(plan));
    nav("/registro/pago", { state: { form: state.form, plan } });
  };

  return (
    <main className="py-12">
      <div className="mx-auto max-w-5xl px-4">
        <h1 className="text-2xl font-bold">Elige tu plan</h1>
        <p className="mt-2 text-sm text-neutral-600">Puedes cambiar de plan más adelante. Los precios son mensuales.</p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-lg font-semibold">Básico</div>
            <div className="text-sm text-neutral-600">Incluye todo para operar desde el día 1</div>
            <div className="mt-2 text-3xl font-bold">
              S/ 300 <span className="text-base font-normal text-neutral-500">/ mes</span>
            </div>
            <ul className="mt-4 space-y-1 text-sm text-neutral-700">
              <li>• Menú digital, categorías y fotos</li>
              <li>• QRs por mesa y estados de pedido</li>
              <li>• Panel de cocina en tiempo real</li>
              <li>• Comanda térmica (Raspberry) incluida</li>
              <li>• Pagos con Culqi u otra pasarela</li>
              <li>• Reporte básico y export CSV</li>
              <li>• Soporte estándar 7/7</li>
            </ul>
            <button onClick={chooseBasic}
              className="mt-5 inline-block rounded-lg bg-neutral-900 px-4 py-2 text-white text-sm hover:bg-neutral-800">
              Elegir Básico
            </button>
          </div>

          <div className="relative rounded-2xl bg-white p-6 opacity-70 ring-1 ring-black/5">
            <span className="absolute right-4 top-4 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              Próximamente
            </span>
            <div className="text-lg font-semibold">Premium</div>
            <div className="text-sm text-neutral-600">Cadenas y operaciones avanzadas</div>
            <div className="mt-2 text-3xl font-bold">S/ —</div>
            <ul className="mt-4 space-y-1 text-sm text-neutral-700">
              <li>• Todo lo del Básico</li>
              <li>• Multi-sede y roles avanzados</li>
              <li>• Métricas avanzadas y API</li>
              <li>• SLA y soporte prioritario</li>
            </ul>
            <button disabled className="mt-5 inline-block cursor-not-allowed rounded-lg border px-4 py-2 text-sm text-neutral-500">
              Elegir Premium
            </button>
            <p className="mt-3 text-xs text-neutral-500">
              ¿Te interesa? Marca la opción “Avísenme del Plan Premium” en el consentimiento o{" "}
              <Link to="/contacto" className="underline">escríbenos</Link>.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
