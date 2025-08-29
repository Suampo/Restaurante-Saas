// src/pages/auth/RegisterRestaurant.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ConsentModal from "../legal/ConsentModal.jsx";

export default function RegisterRestaurant() {
  const nav = useNavigate();

  const [form, setForm] = useState({ nombre: "", email: "", contacto: "", telefono: "" });
  const [errors, setErrors] = useState({});
  const [consent, setConsent] = useState({ required: false, marketing: false });
  const [openConsent, setOpenConsent] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [loading, setLoading] = useState(false);

  const setField = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.nombre.trim()) e.nombre = "Ingresa el nombre del restaurante.";
    if (!form.contacto.trim()) e.contacto = "Ingresa el nombre del contacto.";
    const phone = (form.telefono || "").replace(/\D/g, "");
    if (!phone) e.telefono = "Ingresa un teléfono.";
    else if (phone.length < 9) e.telefono = "Teléfono inválido (mín. 9 dígitos).";
    if (!form.email.trim()) e.email = "Ingresa un correo electrónico.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(form.email)) e.email = "Correo no válido.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitToApi = async () => {
    setLoading(true);
    try {
      // guardamos para rehidratar en el paso de planes
      sessionStorage.setItem("registro_restaurante", JSON.stringify({ ...form, consent }));
      nav("/registro/planes", { state: { form } });
    } catch (err) {
      console.error(err);
      alert("No se pudo registrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    if (!consent.required) {
      setOpenConsent(true);
      setPendingSubmit(true);
      return;
    }
    submitToApi();
  };

  const handleConsentConfirm = ({ marketing }) => {
    setConsent({ required: true, marketing: !!marketing });
    setOpenConsent(false);
    if (pendingSubmit) {
      setPendingSubmit(false);
      submitToApi();
    }
  };

  const inputClass = (err) =>
    `mt-1 w-full rounded-xl border bg-white px-3 py-2 outline-none transition
     ${err ? "border-red-400 focus:border-red-500" : "border-neutral-300 focus:border-emerald-500"}`;

  return (
    // Tono verde de fondo + ocupa el alto de la ventana sin generar desbordes
    <main className="relative min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-emerald-50/40">
      {/* Fondo decorativo controlado (no genera scroll) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute -bottom-48 -right-48 h-[460px] w-[460px] rounded-full bg-teal-300/10 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "radial-gradient(#d1fae5 1px, transparent 1px), radial-gradient(#d1fae5 1px, transparent 1px)",
            backgroundPosition: "0 0, 8px 8px",
            backgroundSize: "16px 16px",
            maskImage: "linear-gradient(180deg, transparent, black 10%, black 90%, transparent)",
          }}
        />
      </div>

      {/* Contenido */}
      <section className="mx-auto max-w-3xl px-4 py-10 md:py-12">
        <h1 className="text-3xl font-bold tracking-tight">Registra tu restaurante</h1>
        <p className="mt-2 text-neutral-700">
          Te tomará menos de 2 minutos. Luego eliges tu plan y pasas al pago.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 grid gap-5" noValidate>
          <div>
            <label htmlFor="nombre" className="text-sm font-medium">Nombre del restaurante</label>
            <input
              id="nombre"
              required
              placeholder="Ej: La Esquina de Juan"
              className={inputClass(!!errors.nombre)}
              value={form.nombre}
              onChange={(e) => setField("nombre", e.target.value)}
            />
            {errors.nombre && <p className="mt-1 text-xs text-red-600">{errors.nombre}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="contacto" className="text-sm font-medium">Contacto</label>
              <input
                id="contacto"
                required
                placeholder="Nombre y apellido"
                className={inputClass(!!errors.contacto)}
                value={form.contacto}
                onChange={(e) => setField("contacto", e.target.value)}
              />
              {errors.contacto && <p className="mt-1 text-xs text-red-600">{errors.contacto}</p>}
            </div>
            <div>
              <label htmlFor="telefono" className="text-sm font-medium">Teléfono</label>
              <input
                id="telefono"
                required
                inputMode="tel"
                placeholder="+51 9xx xxx xxx"
                className={inputClass(!!errors.telefono)}
                value={form.telefono}
                onChange={(e) => setField("telefono", e.target.value)}
              />
              {errors.telefono && <p className="mt-1 text-xs text-red-600">{errors.telefono}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email"
              required
              type="email"
              placeholder="tucorreo@restaurante.com"
              className={inputClass(!!errors.email)}
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <p className="text-xs text-neutral-700">
            Al registrarte aceptas el tratamiento necesario de datos.{" "}
            <button
              type="button"
              onClick={() => setOpenConsent(true)}
              className="underline decoration-emerald-600 underline-offset-2 hover:text-black"
            >
              Ver y aceptar
            </button>.
          </p>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-5 py-3 text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-70"
            >
              {loading ? "Enviando…" : "Continuar"}
            </button>
          </div>
        </form>
      </section>

      {/* Modal de consentimiento */}
      <ConsentModal
        open={openConsent}
        onClose={() => setOpenConsent(false)}
        onConfirm={handleConsentConfirm}
        defaultMarketing={false}
      />
    </main>
  );
}
