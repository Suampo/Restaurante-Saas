// src/pages/auth/Gracias.jsx
import { Link, useLocation } from "react-router-dom";

export default function Gracias() {
  const { search } = useLocation();
  const q = new URLSearchParams(search);
  const plan = q.get("plan") || "basic";
  const mock = q.get("mock");

  return (
    <main className="py-16">
      <div className="mx-auto max-w-xl px-4 text-center">
        <h1 className="text-3xl font-bold">¡Gracias por tu suscripción! 🎉</h1>
        <p className="mt-3 text-neutral-700">
          {mock
            ? "Simulamos el pago correctamente (modo demo)."
            : "Tu pago fue procesado. Te enviaremos un correo con los detalles."}
        </p>
        <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
          Plan: <strong className="font-semibold">{plan}</strong>
        </div>

        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="rounded-xl border px-4 py-2 hover:bg-neutral-50">
            Ir al inicio
          </Link>
          <Link to="/contacto" className="rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500">
            Hablar con ventas
          </Link>
        </div>
      </div>
    </main>
  );
}
