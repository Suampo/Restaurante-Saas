// src/pages/auth/components/ComprobanteModal.jsx
import { useState, useEffect } from "react";

const normalizeEmail = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "");
const isValidEmail  = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
const onlyDigits    = (s) => String(s || "").replace(/\D/g, "");

export default function ComprobanteModal({ open, onClose, onConfirm, prefill = {} }) {
  const [docType, setDocType] = useState("03"); // 03 Boleta, 01 Factura
  const [form, setForm] = useState({
    email: "", phone: "", fullName: "",
    dni: "", ruc: "", razonSocial: "", direccionFiscal: ""
  });

  useEffect(() => {
    setForm(f => ({
      ...f,
      email: prefill.email || f.email,
      phone: prefill.telefono || prefill.phone || f.phone,
      fullName: prefill.contacto || prefill.contact || f.fullName,
    }));
  }, [prefill]);

  if (!open) return null;
  const wantFactura = docType === "01";
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    // normalización
    const email = normalizeEmail(form.email);
    const phone = onlyDigits(form.phone);
    const dni   = onlyDigits(form.dni);
    const ruc   = onlyDigits(form.ruc);

    // validaciones
    if (!isValidEmail(email)) return alert("Correo inválido (revisa que no tenga espacios y tenga un dominio válido).");

    if (phone && phone.length < 9) {
      return alert("Teléfono inválido (debe tener 9 dígitos en Perú).");
    }

    if (docType === "03") { // Boleta
      if (!form.fullName.trim()) return alert("Nombre para boleta.");
      if (dni && dni.length !== 8) return alert("DNI inválido (8 dígitos).");
    }

    if (docType === "01") { // Factura
      if (!ruc || ruc.length !== 11) return alert("RUC inválido (11 dígitos).");
      if (!form.razonSocial.trim()) return alert("Ingresa la Razón Social.");
      if (!form.direccionFiscal.trim()) return alert("Ingresa el Domicilio Fiscal.");
    }

    onConfirm({
      docType,
      customer: {
        ...form,
        email,
        phone,
        dni,
        ruc
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Datos para el comprobante</h3>

        <div className="flex gap-4 mb-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="docType" value="03"
              checked={docType==="03"} onChange={() => setDocType("03")} />
            Boleta
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="docType" value="01"
              checked={docType==="01"} onChange={() => setDocType("01")} />
            Factura
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="email" className="border rounded-lg p-2" placeholder="correo@dominio.com"
            value={form.email} onChange={e=>set("email", e.target.value)} />
          <input inputMode="tel" className="border rounded-lg p-2" placeholder="+51 9xx xxx xxx"
            value={form.phone} onChange={e=>set("phone", e.target.value)} />
          <input className="border rounded-lg p-2 md:col-span-2" placeholder="Nombre completo"
            value={form.fullName} onChange={e=>set("fullName", e.target.value)} />
          {docType==="03" && (
            <input inputMode="numeric" className="border rounded-lg p-2 md:col-span-2" placeholder="DNI (opcional)"
              value={form.dni} onChange={e=>set("dni", e.target.value)} />
          )}
        </div>

        {wantFactura && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <input inputMode="numeric" className="border rounded-lg p-2" placeholder="RUC"
              value={form.ruc} onChange={e=>set("ruc", e.target.value)} />
            <input className="border rounded-lg p-2" placeholder="Razón Social"
              value={form.razonSocial} onChange={e=>set("razonSocial", e.target.value)} />
            <input className="border rounded-lg p-2 md:col-span-2" placeholder="Domicilio fiscal"
              value={form.direccionFiscal} onChange={e=>set("direccionFiscal", e.target.value)} />
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancelar</button>
          <button onClick={submit} className="px-4 py-2 rounded-lg bg-emerald-600 text-white">
            Confirmar y pagar
          </button>
        </div>
      </div>
    </div>
  );
}
