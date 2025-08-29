// src/controllers/checkoutController.js
import { createCulqiOrder } from "../services/culqiService.js";

const PLANS = {
  basic: { id: "basic", name: "Básico", amount: 30000 }, // S/300 => céntimos
  // pro:   { id: "pro",   name: "Premium", amount: 00000 },
};

function safeEmail(s) { return String(s || "").trim().toLowerCase(); }
function cents(n) { return Math.round(Number(n || 0)); }

export async function apiCheckoutPrepare(req, res) {
  try {
    const {
      planId = "basic",
      amount,                 // del front (céntimos)
      currency = "PEN",
      restaurant = { id: null, name: "" },
      docType,                // "03" Boleta | "01" Factura
      customer = {},
    } = req.body || {};

    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ error: "Plan inválido" });

    // Seguridad: el monto final lo define el servidor
    const expected = cents(plan.amount);
    if (!expected) return res.status(400).json({ error: "Monto del plan inválido" });

    // Validaciones mínimas del comprobante
    const email = safeEmail(customer.email);
    if (!email) return res.status(400).json({ error: "Email requerido" });
    if (docType !== "01" && docType !== "03") {
      return res.status(400).json({ error: "Tipo de comprobante inválido" });
    }
    if (docType === "01") {
      const ruc = String(customer.ruc || "").replace(/\D/g, "");
      if (ruc.length !== 11) return res.status(400).json({ error: "RUC inválido" });
      if (!customer.razonSocial) return res.status(400).json({ error: "Razón Social requerida" });
      if (!customer.direccionFiscal) return res.status(400).json({ error: "Domicilio fiscal requerido" });
    } else {
      if (!customer.fullName) return res.status(400).json({ error: "Nombre para boleta requerido" });
    }

    // Metadata para conciliación/onboarding
    const metadata = {
      onboarding: true,
      plan_id: plan.id,
      plan_name: plan.name,
      restaurant_id: restaurant?.id || null,
      restaurant_name: restaurant?.name || "",
      doc_type: docType,                 // "01" / "03"
      customer_email: email,
      customer_phone: String(customer.phone || ""),
      customer_full_name: String(customer.fullName || ""),
      customer_dni: String(customer.dni || ""),
      customer_ruc: String(customer.ruc || ""),
      customer_razon: String(customer.razonSocial || ""),
      customer_direccion: String(customer.direccionFiscal || ""),
      // podrías agregar un idempotency_key si quieres
    };

    // Si aún no te habilitan "orders" en Culqi, ofrece un fallback
    if (process.env.ALLOW_MOCK_PAY === "true") {
      // redirige a una “gracias” simple mientras Culqi te habilita
      const base = process.env.CLIENT_PUBLIC_URL || "http://localhost:5174";
      return res.json({
        paymentUrl: `${base}/registro/gracias?mock=1&plan=${plan.id}`,
        mock: true,
      });
    }

    // —— Flujo real con Culqi Orders ——
    const order = await createCulqiOrder({
      amount: expected,
      currency,
      description: `Suscripción ${plan.name} — ${restaurant?.name || customer.fullName}`,
      email,
      metadata,
      paymentMethods: { card: true, yape: true }, // orden admite Yape
    });

    return res.json({ culqi: { orderId: order?.id }, amount: expected, currency });
  } catch (e) {
    console.error("apiCheckoutPrepare:", e.message);
    // Si Culqi no te habilitó orders, avisa claro al front
    return res.status(502).json({
      error: "Contactar al comercio.",
      detail: e.message,
    });
  }
}
