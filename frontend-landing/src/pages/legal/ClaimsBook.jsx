// src/pages/legal/ClaimsBook.jsx
import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function ClaimsBook() {
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    tipo: "Reclamo", // Reclamo | Queja
    nombre: "",
    documento_tipo: "DNI",
    documento_numero: "",
    email: "",
    telefono: "",
    direccion: "",
    pedido_fecha: "",
    pedido_monto: "",
    detalle: "",
    acepta_tratamiento: false,
    acepta_respuesta_email: true,
  });

  const onChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const validate = () => {
    if (!form.nombre.trim()) return "Ingresa tu nombre.";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) return "Correo inválido.";
    if (!form.detalle.trim()) return "Describe tu reclamo/queja.";
    if (!form.acepta_tratamiento) return "Debes aceptar el tratamiento de datos.";
    return "";
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const v = validate();
    if (v) { setError(v); return; }

    try {
      setLoading(true);
      const payload = {
        tipo: form.tipo,
        nombre: form.nombre,
        documento_tipo: form.documento_tipo,
        documento_numero: form.documento_numero || null,
        email: form.email,
        telefono: form.telefono || null,
        direccion: form.direccion || null,
        detalle: form.detalle,
        pedido_fecha: form.pedido_fecha || null,
        pedido_monto: form.pedido_monto ? Number(form.pedido_monto) : null,
        acepta_tratamiento: form.acepta_tratamiento,
        acepta_respuesta_email: form.acepta_respuesta_email,
      };

      const { error } = await supabase.from("reclamaciones").insert([payload]);
      if (error) throw error;

      setOk(true);
      setForm({
        tipo: "Reclamo",
        nombre: "",
        documento_tipo: "DNI",
        documento_numero: "",
        email: "",
        telefono: "",
        direccion: "",
        pedido_fecha: "",
        pedido_monto: "",
        detalle: "",
        acepta_tratamiento: false,
        acepta_respuesta_email: true,
      });
    } catch (err) {
      setError(err.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Libro de Reclamaciones</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Registra tu <strong>Reclamo</strong> (disconformidad relacionada al producto/servicio) o <strong>Queja</strong> (malestar no relacionado al producto/servicio).
      </p>

      {ok && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">
          ¡Gracias! Tu registro fue enviado correctamente.
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-900">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="mt-6 grid gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tipo</span>
            <select name="tipo" value={form.tipo} onChange={onChange} className="rounded-lg border px-3 py-2">
              <option>Reclamo</option>
              <option>Queja</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Nombre completo</span>
            <input name="nombre" value={form.nombre} onChange={onChange} className="rounded-lg border px-3 py-2" required />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Documento</span>
            <select name="documento_tipo" value={form.documento_tipo} onChange={onChange} className="rounded-lg border px-3 py-2">
              <option>DNI</option>
              <option>CE</option>
              <option>Pasaporte</option>
              <option>RUC</option>
            </select>
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">N° de documento</span>
            <input name="documento_numero" value={form.documento_numero} onChange={onChange} className="rounded-lg border px-3 py-2" />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Correo electrónico</span>
            <input type="email" name="email" value={form.email} onChange={onChange} className="rounded-lg border px-3 py-2" required />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Teléfono</span>
            <input name="telefono" value={form.telefono} onChange={onChange} className="rounded-lg border px-3 py-2" />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Dirección</span>
          <input name="direccion" value={form.direccion} onChange={onChange} className="rounded-lg border px-3 py-2" />
        </label>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Fecha del consumo (opcional)</span>
            <input type="date" name="pedido_fecha" value={form.pedido_fecha} onChange={onChange} className="rounded-lg border px-3 py-2" />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Monto involucrado S/ (opcional)</span>
            <input type="number" step="0.01" name="pedido_monto" value={form.pedido_monto} onChange={onChange} className="rounded-lg border px-3 py-2" />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm font-medium">Detalle de tu reclamo/queja</span>
          <textarea name="detalle" value={form.detalle} onChange={onChange} rows={5} className="rounded-lg border px-3 py-2" required />
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acepta_tratamiento" checked={form.acepta_tratamiento} onChange={onChange} className="mt-1" />
          <span>Acepto el tratamiento de mis datos personales conforme a la <a href="/legal/privacidad" className="underline">Política de Privacidad</a>.</span>
        </label>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="acepta_respuesta_email" checked={form.acepta_respuesta_email} onChange={onChange} className="mt-1" />
          <span>Autorizo a que me respondan por correo electrónico.</span>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? "Enviando..." : "Enviar registro"}
        </button>
      </form>
    </section>
  );
}
