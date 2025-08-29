import { useEffect, useState } from "react";

export default function BillingModal({ open, onClose, onSubmit, loading }) {
  const [comprobante, setComprobante] = useState("boleta"); // "boleta" | "factura"
  const [docType, setDocType] = useState("DNI");            // "DNI" | "RUC"
  const [docNumber, setDocNumber] = useState("");
  const [name, setName] = useState("");                     // nombres o razón social
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  // Códigos SUNAT para APIsPERU
  const DOC_CODES = { DNI: "1", RUC: "6" };

  // Helper: separar nombres/apellidos (simple)
  const splitName = (full) => {
    const s = String(full || "").trim().replace(/\s+/g, " ");
    if (!s) return { nombres: "", apellidos: "" };
    const parts = s.split(" ");
    if (parts.length === 1) return { nombres: parts[0], apellidos: "" };
    return {
      nombres: parts.slice(0, -1).join(" "),
      apellidos: parts.slice(-1).join(""),
    };
  };

  // Sincroniza tipo de doc según comprobante
  useEffect(() => {
    if (comprobante === "boleta" && docType === "RUC") setDocType("DNI");
    if (comprobante === "factura") setDocType("RUC");
  }, [comprobante]); // eslint-disable-line

  if (!open) return null;

  const validate = () => {
    if (comprobante === "boleta") {
      if (docType !== "DNI") return "Para boleta usa DNI.";
      if (!/^\d{8}$/.test(docNumber)) return "DNI inválido (8 dígitos).";
      if (!name.trim()) return "Ingresa tus nombres y apellidos.";
    } else {
      if (docType !== "RUC") return "Para factura usa RUC.";
      if (!/^\d{11}$/.test(docNumber)) return "RUC inválido (11 dígitos).";
      if (!name.trim()) return "Ingresa la Razón Social.";
      if (!address.trim()) return "Ingresa la dirección fiscal.";
    }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) return "Email inválido.";
    return null;
  };

  const buildPayload = () => {
    const comprobanteTipo = comprobante === "factura" ? "01" : "03";
    const trimmedEmail = String(email || "").trim();
    const trimmedAddress = String(address || "").trim();

    let billingClient;
    if (comprobante === "factura") {
      // FACTURA → RUC
      billingClient = {
        tipoDoc: DOC_CODES.RUC,      // "6"
        numDoc: String(docNumber).trim(),
        rznSocial: String(name).trim(),
        email: trimmedEmail,
        direccion: trimmedAddress,
      };
    } else {
      // BOLETA → DNI
      const { nombres, apellidos } = splitName(name);
      billingClient = {
        tipoDoc: DOC_CODES.DNI,      // "1"
        numDoc: String(docNumber).trim(),
        nombres,
        apellidos,
        email: trimmedEmail,
        direccion: trimmedAddress,
      };
    }

    return {
      // === LO QUE USARÁ TU BACKEND ===
      comprobanteTipo,       // "01" | "03"
      billingClient,         // objeto alineado a APIsPERU
      billingEmail: trimmedEmail,

      // === (Opcional) dejar lo crudo por si lo quieres loguear/usar) ===
      raw: {
        comprobante,         // "boleta" | "factura"
        docType,             // "DNI" | "RUC"
        docNumber,
        name,
        email: trimmedEmail,
        address: trimmedAddress,
      },
    };
  };

  const submit = (e) => {
    e.preventDefault();
    const err = validate();
    if (err) return alert(err);
    const payload = buildPayload();
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-lg rounded-2xl bg-white text-neutral-900 shadow-lg">
        <div className="px-5 py-4 border-b">
          <h2 className="text-lg font-semibold">Datos para Boleta/Factura</h2>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {/* Comprobante */}
          <div>
            <label className="block text-sm font-medium mb-1">Tipo de comprobante</label>
            <div className="flex gap-3">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="comp"
                  value="boleta"
                  checked={comprobante === "boleta"}
                  onChange={() => setComprobante("boleta")}
                />
                <span>Boleta</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="comp"
                  value="factura"
                  checked={comprobante === "factura"}
                  onChange={() => setComprobante("factura")}
                />
                <span>Factura</span>
              </label>
            </div>
          </div>

          {/* Doc */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-1">Tipo doc.</label>
              <select
                className="w-full rounded-md border px-3 py-2"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={comprobante === "factura"}
              >
                <option>DNI</option>
                <option disabled={comprobante === "boleta"}>RUC</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1">
                {docType === "RUC" ? "RUC" : "DNI"}
              </label>
              <input
                className="w-full rounded-md border px-3 py-2"
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                placeholder={docType === "RUC" ? "11 dígitos" : "8 dígitos"}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              {docType === "RUC" ? "Razón Social" : "Nombres y Apellidos"}
            </label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={docType === "RUC" ? "Mi Empresa S.A.C." : "Juan Pérez"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Dirección (opcional, requerida para factura)</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Av. Siempre Viva 123"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email (opcional)</label>
            <input
              className="w-full rounded-md border px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@correo.com"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Procesando…" : "Continuar a pagar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
