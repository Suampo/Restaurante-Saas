// backend-billing/index.js
import express from "express";
import cors from "cors";
import "dotenv/config";

// --- Validación de env y de que la key sea service_role ---
const url = (process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

function decodeRole(jwt) {
  try {
    const payload = JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"));
    return payload.role;
  } catch {
    return "unknown";
  }
}

if (!url || !key) {
  console.error("[FATAL] Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env");
  process.exit(1);
}
const role = decodeRole(key);
if (role !== "service_role") {
  console.error(`[FATAL] La key no es service_role (role=${role}). Copia la Service role key del dashboard.`);
  process.exit(1);
}

// --- Imports restantes ---
import { nanoid } from "nanoid";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import { randomUUID, createHmac } from "crypto";

const app = express();

// Confianza en proxy/HTTPS en producción (Nginx/Traefik)
app.set("trust proxy", 1);

// CORS (allowlist opcional por env: ALLOWED_ORIGINS="https://mikhunapp.vercel.app,https://tu-dominio.com")
const allowlist = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowlist.length === 0 || allowlist.includes(origin)) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  }
}));
app.use(express.json({ limit: "1mb" }));

const USE_MOCK   = String(process.env.USE_MOCK   || "").toLowerCase() === "true";
const USE_LEGACY = String(process.env.USE_LEGACY || "").toLowerCase() === "true";

/* ----------------------- SUPABASE ADMIN (Service Role) ---------------------- */
const supa = createClient(url, key);

// helpers de normalización/validación
const normalizeEmail = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, "");
const isValidEmail   = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(s);
const onlyDigits     = (s) => String(s || "").replace(/\D/g, "");

/** Crea o asegura un usuario por email usando Admin API (modo nuevo) */
async function ensureUserByEmail(email, fullName) {
  const emailNorm = normalizeEmail(email);
  if (!isValidEmail(emailNorm)) throw new Error(`email inválido: "${email}"`);
  const pwd = randomUUID().slice(0, 16);

  const { data, error } = await supa.auth.admin.createUser({
    email: emailNorm,
    password: pwd,
    email_confirm: true,
    user_metadata: { full_name: fullName || "" },
  });
  if (!error && data?.user?.id) return data.user.id;

  const { data: list } = await supa.auth.admin.listUsers();
  const u = list?.users?.find((x) => x.email?.toLowerCase() === emailNorm);
  if (!u) throw error || new Error("No se pudo crear/ubicar usuario");
  return u.id;
}

/** Crea el tenant y su membresía para el user (modo nuevo) */
async function createTenantForUser({ userId, restaurantName, phone }) {
  const { data, error } = await supa.rpc("register_restaurant_and_admin_v2", {
    p_user_id: userId,
    p_restaurant_name: restaurantName,
    p_phone: phone ?? null,
    p_role: "owner",
  });
  if (error) throw error;
  return data; // { restaurant_id, user_id }
}

/** LEGACY: crea restaurante + usuario (idempotente) */
async function createLegacyRestaurantAndUser({ restaurantName, phone, contactName, email, password }) {
  const emailNorm   = normalizeEmail(email);
  const phoneDigits = onlyDigits(phone) || null;
  if (!isValidEmail(emailNorm)) throw new Error(`email inválido: "${email}"`);

  // 0) Si ya existe usuario por email → reutiliza y NO crees nada más
  const { data: existingUser } = await supa
    .from("usuarios")
    .select("id, restaurant_id")
    .eq("email", emailNorm)
    .maybeSingle();

  if (existingUser?.id) {
    return { restaurante_id: existingUser.restaurant_id, usuario_id: existingUser.id, temp_password: null };
  }

  // 1) Busca restaurante por (nombre,telefono). Si existe, reutilízalo
  let restaurante_id = null;
  const { data: foundRestByBoth } = await supa
    .from("restaurantes")
    .select("id")
    .eq("nombre", restaurantName)
    .eq("telefono", phoneDigits)
    .maybeSingle();

  if (foundRestByBoth?.id) {
    restaurante_id = foundRestByBoth.id;
  } else {
    // como a veces el teléfono viene vacío, intenta solo por nombre
    const { data: foundRestByName } = await supa
      .from("restaurantes")
      .select("id")
      .eq("nombre", restaurantName)
      .maybeSingle();

    if (foundRestByName?.id) {
      restaurante_id = foundRestByName.id;
    } else {
      // 2) Inserta restaurante nuevo
      const { data: restIns, error: restErr } = await supa
        .from("restaurantes")
        .insert({ nombre: restaurantName, telefono: phoneDigits })
        .select("id")
        .single();

      if (restErr) {
        // Si justo chocó por secuencia/duplicado, reintenta buscando por nombre
        const { data: again } = await supa
          .from("restaurantes")
          .select("id")
          .eq("nombre", restaurantName)
          .maybeSingle();
        if (!again?.id) throw restErr;
        restaurante_id = again.id;
      } else {
        restaurante_id = restIns.id;
      }
    }
  }

  // 3) Crea usuario con clave única
  const pwd = password || process.env.LEGACY_DEFAULT_PASSWORD || "123456";
  const { data: userIns, error: userErr } = await supa
    .from("usuarios")
    .insert({
      restaurant_id: restaurante_id,
      nombre: contactName || "",
      email: emailNorm,
      password: pwd,   // tu login actual usa este campo plano
      rol: "admin",
    })
    .select("id")
    .single();

  if (userErr) {
    // Si falló por duplicado (webhook duplicado), reutiliza el existente
    const { data: existing } = await supa
      .from("usuarios")
      .select("id")
      .eq("email", emailNorm)
      .maybeSingle();
    if (!existing?.id) throw userErr;
    return { restaurante_id, usuario_id: existing.id, temp_password: null };
  }

  return { restaurante_id, usuario_id: userIns.id, temp_password: pwd };
}

// (opcional) enviar por email la clave temporal si configuras SMTP en .env
async function maybeSendEmail({ to, name, tempPassword, restaurantName }) {
  try {
    if (!process.env.SMTP_HOST) return; // no hay configuración -> no enviar
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    const html = `
      <p>Hola ${name || ""},</p>
      <p>Tu restaurante <b>${restaurantName}</b> ya fue creado.</p>
      <p>Usuario: <b>${to}</b><br/>Clave temporal: <b>${tempPassword}</b></p>
      <p>Por seguridad, cámbiala al ingresar.</p>
    `;
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: "Acceso a tu panel",
      html,
    });
  } catch (err) {
    console.warn("No se pudo enviar email (opcional):", err.message);
  }
}

/* --------------------------- Helper: firmar payload ------------------------- */
function hmacSign(bodyString) {
  const key = process.env.FACTURACION_KEY || "";
  if (!key) throw new Error("FACTURACION_KEY no configurada");
  return createHmac("sha256", key).update(bodyString).digest("hex");
}

/* --------------------------------------------------------------------------- */

app.get("/api/health", (_, res) => res.json({ ok: true }));

// 1) PREPARE CHECKOUT (lo llama tu frontend-landing)
// 1) PREPARE CHECKOUT (lo llama tu frontend-landing)
app.post("/api/checkout/prepare", async (req, res) => {
  try {
    const { planId, amount, currency, restaurant, docType, customer } = req.body || {};
    if (!planId || !amount || !currency || !docType || !customer?.email) {
      return res.status(400).json({ error: "Payload incompleto" });
    }

    // Si aún estás en mock y quieres solo redirección de prueba, descomenta esto:
    // if (USE_MOCK) {
    //   const internalOrderId = nanoid();
    //   return res.json({ paymentUrl: `https://example.com/mock-payment?o=${internalOrderId}` });
    // }

    // Lee el secreto de Culqi (acepta CULQI_SECRET_KEY o CULQI_SECRET)
    const CULQI_SECRET = process.env.CULQI_SECRET_KEY || process.env.CULQI_SECRET;
    if (!CULQI_SECRET) return res.status(500).json({ error: "Falta CULQI_SECRET o CULQI_SECRET_KEY en .env" });

    // 1) Crear Order en Culqi
    const internalOrderId = nanoid();
    const r = await fetch("https://api.culqi.com/v2/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CULQI_SECRET}`,
      },
      body: JSON.stringify({
        amount,                         // céntimos
        currency_code: currency,        // "PEN"
        description: `Suscripción ${planId}`,
        order_number: internalOrderId,
        expiration_date: Math.floor(Date.now() / 1000) + 3600, // 1h
        client_details: {
          first_name: customer.fullName || "",
          email: customer.email,
          phone_number: customer.phone || "",
        },
        // IMPORTANTE: metadata que leerá tu webhook
        metadata: {
          planId,
          docType,
          dni: customer.dni || "",
          ruc: customer.ruc || "",
          razonSocial: customer.razonSocial || "",
          direccionFiscal: customer.direccionFiscal || "",
          restaurantName: restaurant?.name || "",
        },
        // Si prefieres link de pago en vez del modal: agrega confirm:false y devuelve payment_url
      }),
    });

    const order = await r.json();
    if (!r.ok) {
      const msg = order?.user_message || order?.merchant_message || "Culqi error";
      return res.status(502).json({ error: msg, culqi: order });
    }

    // 2) Para checkout-js (script https://js.culqi.com/checkout-js en el frontend)
    return res.json({
      culqi: { orderId: order.id },
      // Si quisieras link de pago:
      // paymentUrl: order.payment_url,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Fallo en prepare" });
  }
});

// 2) WEBHOOK DE LA PASARELA (Culqi)
app.post("/api/culqi/webhook", async (req, res) => {
  try {
    const evt = req.body || {};
    console.log("WEBHOOK:", evt?.type || "sin-type");

    if (evt?.type === "charge.succeeded" || USE_MOCK) {
      const meta = evt?.data?.metadata || {
        email: "cliente@mock.com",
        fullName: "Cliente Mock",
        restaurantName: "Restaurante Mock",
        phone: "+51 999999999",
        docType: "03",
        ruc: "",
        razonSocial: "",
        direccionFiscal: "",
      };

      if (USE_LEGACY) {
        // ----- MODO LEGACY: crea en tus tablas y genera password único -----
        const tempPwd = nanoid(10); // clave única por usuario
        try {
          const ids = await createLegacyRestaurantAndUser({
            restaurantName: meta.restaurantName,
            phone: meta.phone,
            contactName: meta.fullName,
            email: meta.email,
            password: tempPwd,
          });
          console.log("Legacy creados:", ids, "tempPwd:", tempPwd);

          // (opcional) enviar por email si configuraste SMTP_*
          await maybeSendEmail({
            to: normalizeEmail(meta.email),
            name: meta.fullName,
            tempPassword: tempPwd,
            restaurantName: meta.restaurantName,
          });
        } catch (err) {
          console.error("Error creando legacy:", err.message);
        }
      } else {
        // ----- MODO NUEVO (Auth + restaurants/restaurant_members) -----
        try {
          const userId = await ensureUserByEmail(meta.email, meta.fullName);
          const { restaurant_id } = await createTenantForUser({
            userId,
            restaurantName: meta.restaurantName,
            phone: meta.phone,
          });
          console.log("Tenant creado:", { restaurant_id, userId });
        } catch (err) {
          console.error("No se pudo crear usuario/tenant:", err.message);
        }
      }

      // 3) Emitir CPE
      const amount = evt?.data?.amount ?? 30000; // céntimos
      const cpePayload = mapToCPE({
        planId: "basic",
        amount,
        docType: meta.docType,
        restaurantName: meta.restaurantName,
        customer: {
          email: normalizeEmail(meta.email),
          ruc: meta.ruc || "",
          razonSocial: meta.razonSocial || "",
          direccionFiscal: meta.direccionFiscal || "",
          fullName: meta.fullName || "",
        },
        paymentChargeId: evt?.data?.id || "mock_charge",
      });

      if (process.env.FACTURACION_URL && process.env.FACTURACION_KEY) {
        try {
          const body = JSON.stringify(cpePayload);
          const sign = hmacSign(body);

          const resp = await fetch(`${process.env.FACTURACION_URL}/api/cpe/emitir`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Api-Key": process.env.FACTURACION_KEY,
              "X-Sign": sign,
            },
            body,
          });
          const emis = await resp.json().catch(() => ({}));
          console.log("CPE RESP:", emis);
        } catch (err) {
          console.error("Error emitiendo CPE:", err.message);
        }
      } else {
        console.log("FACTURACION_URL/FACTURACION_KEY no configuradas. Saltando emisión de CPE.");
      }
    }

    // Siempre 200 para evitar reintentos infinitos de la pasarela
    return res.sendStatus(200);
  } catch (e) {
    console.error(e);
    return res.sendStatus(200);
  }
});

// ---------- Helpers ----------
function mapToCPE({ planId, amount, docType, restaurantName, customer, paymentChargeId }) {
  const total = (amount || 0) / 100;
  const base = round2(total / 1.18);
  const igv  = round2(total - base);

  const isFactura = docType === "01";
  const cliente = isFactura
    ? { tipoDoc: "6", numDoc: customer.ruc, razonSocial: customer.razonSocial, direccion: customer.direccionFiscal }
    : { tipoDoc: customer?.dni ? "1" : "-", numDoc: customer?.dni || "-", razonSocial: customer?.fullName || "-", direccion: "-" };

  return {
    tipoComprobante: docType,
    serie: isFactura ? (process.env.SERIE_FACTURA || "F001") : (process.env.SERIE_BOLETA || "B001"),
    numero: 0,
    emisor: {
      ruc: process.env.EMISOR_RUC,
      razonSocial: process.env.EMISOR_RS,
      domicilioFiscal: process.env.EMISOR_DIR,
      ubigeo: process.env.EMISOR_UBIGEO,
    },
    cliente,
    items: [{
      codigo: (planId || "PLAN").toUpperCase(),
      descripcion: `Suscripción ${planId} - Renovación mensual (${restaurantName || "-"})`,
      cantidad: 1,
      valorUnitario: base,
      igv: igv,
      precioUnitario: round2(base + igv),
      tipoAfectacionIGV: "10",
    }],
    totales: { opGravadas: base, igv: igv, importeTotal: round2(base + igv) },
    referencias: { paymentChargeId, ordenInterna: "internal_id_aqui" },
  };
}
function round2(n) { return Math.round(n * 100) / 100; }

app.listen(process.env.PORT || 3000, () =>
  console.log(`backend-billing listo en http://localhost:${process.env.PORT || 3000}`)
);
