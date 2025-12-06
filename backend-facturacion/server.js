// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

// Middlewares
const requireWaiter = require("./src/middlewares/requireWaiter");
const { requireCsrf } = require("./src/middlewares/csrf");

// (opcional) DB ping de prueba
const pool = require("./src/db");

// Routers
const mozoAuthRoutes = require("./src/routes/auth.mozo");
const splitRoutes = require("./src/routes/split.payments.js");
const cashRoutes = require("./src/routes/split/cash.routes.js");
const debugApisPeru = require("./src/routes/debug.apisperu");
const debugCpe = require("./src/routes/debug.cpe");
const debugPedidos = require("./src/routes/debug.pedidos");
const pedidos = require("./src/routes/pedidos");
const publicRestaurants = require("./src/routes/public.restaurants");
const pspMP = require("./src/routes/psp.mercadopago");
const mpWebhook = require("./src/routes/webhook.mp");
const checkoutRoutes = require("./src/routes/checkout.routes");
const adminCashRoutes = require("./src/routes/admin.cash");
const adminFacturacionRoutes = require("./src/routes/admin.facturacion");

const app = express();

/* ---------- Base app ---------- */

// si algún día estás detrás de proxy (Railway/Render/Nginx)
app.set("trust proxy", 1);

// quita X-Powered-By: Express  (riesgo bajo fingerprinting)
app.disable("x-powered-by");

/* ---------- CORS (riesgo medio #2: sin wildcard) ---------- */

// Orígenes que quieres permitir (dev + los de CORS_ORIGINS)
const defaultOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const allowlist = [...new Set([...defaultOrigins, ...envOrigins])];

const baseCors = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allowedHeaders: [
  "Content-Type",
  "x-csrf-token",
  "authorization",
  "x-restaurant-id",
  "x-app-restaurant-id",
  "x-app-user-id",
  "x-db-token",
  "x-app-user"        // 👈 FALTABA ESTE
],
  exposedHeaders: ["Content-Disposition"],
};

const corsOptions = {
  ...baseCors,
  origin(origin, cb) {
    // Peticiones sin Origin (curl, Postman, ZAP en modo raw) → no añadimos CORS
    if (!origin) return cb(null, false);

    if (allowlist.includes(origin)) {
      // Devolvemos el mismo origin (no "*" -> ZAP contento)
      return cb(null, origin);
    }
    return cb(new Error("CORS not allowed"), false);
  },
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight

/* ---------- HELMET (cabeceras de seguridad) ---------- */

// Helmet base (sin HSTS aquí; lo activamos sólo en prod + HTTPS)
app.use(
  helmet({
    hsts: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// X-Content-Type-Options: nosniff (riesgo bajo #7)
app.use(helmet.noSniff());

// Fuerza siempre el header por si alguna respuesta se escapa de Helmet
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

// Anti-clickjacking (riesgo medio #3)
app.use(
  helmet.frameguard({
    action: "sameorigin",
  })
);

// CSP endurecida (riesgo medio #1) – sin 'unsafe-inline'
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],          // 👈 sin 'unsafe-inline'
      styleSrc: ["'self'"],           // 👈 sin 'unsafe-inline'
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "https://facturacion.apisperu.com",
        "https://api.mercadopago.com",
        "https://*.supabase.co",
      ],
      frameAncestors: ["'self'"],     // también ayuda contra clickjacking
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  })
);

// HSTS (riesgo bajo #9) → SOLO cuando estés en producción con HTTPS
if (process.env.NODE_ENV === "production") {
  app.use(
    helmet.hsts({
      maxAge: 60 * 60 * 24 * 30, // 30 días
      includeSubDomains: true,
      preload: false,
    })
  );
}

/* ---------- Parsers ---------- */
app.use(cookieParser());
// aceptamos JSON con cualquier content-type por si MP/otros envían 'text/plain'
app.use(express.json({ type: "*/*" }));

/* ---------- Ping ---------- */
app.get("/", (_req, res) => res.send("backend-facturacion OK"));

/* ---------- CSRF (double-submit cookie) ---------- */
/**
 * Cookie CSRF solo para protección de peticiones (NO es cookie de sesión).
 * - httpOnly: false de forma intencional, el front la lee y manda en `x-csrf-token`.
 * - Restringida a rutas /api, con SameSite=Lax, Secure en producción y expiración.
 */
app.get("/api/csrf", (req, res) => {
  let token = req.cookies?.csrf_token;
  if (!token) {
    token = crypto.randomBytes(16).toString("hex");
  }

  res.cookie("csrf_token", token, {
    httpOnly: false,                                // riesgo bajo aceptado, no es sesión
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api",                                   // 🔒 limitar ámbito a /api
    maxAge: 1000 * 60 * 60 * 12,                    // 🔒 12 horas
  });

  res.json({ ok: true });
});


/* ---------- Debug sólo en no-producción ---------- */
if (process.env.NODE_ENV !== "production") {
  app.use("/", debugApisPeru);
  app.use("/", debugCpe);
  app.use("/debug", debugPedidos);

  app.get("/debug/db-ping", async (_req, res) => {
    try {
      const { rows } = await pool.query("select now() as now");
      res.json({ ok: true, now: rows[0].now });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

/* ---------- Público/PSP ---------- */
app.use("/", publicRestaurants);
app.use("/", pspMP);
app.use("/", mpWebhook);

// Login de mozo propio de :5000 (si lo usas)
app.use("/", mozoAuthRoutes);

/* ---------- APIs protegidas ---------- */
app.use("/api", pedidos);

// Rutas de administración (caja, facturación, etc.)
app.use("/api/admin", adminCashRoutes);
app.use("/api/admin", adminFacturacionRoutes)
// Split pagos mixtos/tarjeta
app.use("/api/split", requireCsrf, requireWaiter, splitRoutes);

// ⚠️ Split efectivo (archivo cash.routes.js)
app.use("/api/split", requireCsrf, requireWaiter, cashRoutes);


// Checkout (pasarela) — protegido con CSRF
app.use("/api/checkout", requireCsrf, checkoutRoutes);

/* ---------- Echo ---------- */
app.post("/webhooks/echo", (req, res) => {
  console.log(
    "[ECHO]",
    new Date().toISOString(),
    req.headers["user-agent"] || "",
    req.body
  );
  res.json({ ok: true, got: req.body });
});

/* ---------- Listen ---------- */
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on :${port}`));
