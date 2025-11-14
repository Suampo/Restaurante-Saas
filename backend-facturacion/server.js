// server.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");

// Middlewares
const requireWaiter = require("./src/middlewares/requireWaiter");
const { requireCsrf } = require("./src/middlewares/csrf");

// (opcional) DB ping de prueba
const pool = require("./src/db");

// Routers
const mozoAuthRoutes     = require("./src/routes/auth.mozo");
const splitRoutes        = require("./src/routes/split.payments.js");
const cashRoutes         = require("./src/routes/split/cash.routes");
const debugApisPeru      = require("./src/routes/debug.apisperu");
const debugCpe           = require("./src/routes/debug.cpe");
const debugPedidos       = require("./src/routes/debug.pedidos");
const pedidos            = require("./src/routes/pedidos");
const publicRestaurants  = require("./src/routes/public.restaurants");
const pspMP              = require("./src/routes/psp.mercadopago");
const mpWebhook          = require("./src/routes/webhook.mp");
const checkoutRoutes     = require("./src/routes/checkout.routes");
const adminCashRoutes    = require("./src/routes/admin.cash");

const app = express();

/* ---------- CORS + parsers ---------- */
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const baseCors = {
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  // MUY IMPORTANTE: permitir authorization y x-csrf-token
  allowedHeaders: ["Content-Type", "x-csrf-token", "authorization"],
};

const corsOptions = allowed.length
  ? {
      ...baseCors,
      origin(origin, cb) {
        if (!origin) return cb(null, true); // curl / healthchecks
        return allowed.includes(origin)
          ? cb(null, true)
          : cb(new Error("CORS not allowed"), false);
      },
    }
  : { ...baseCors, origin: true };

app.use(cors(corsOptions));
app.use(cookieParser());
// aceptamos JSON con cualquier content-type por si MP/otros envían 'text/plain'
app.use(express.json({ type: "*/*" }));

/* ---------- Ping ---------- */
app.get("/", (_req, res) => res.send("backend-facturacion OK"));

/* ---------- CSRF (double-submit cookie) ---------- */
app.get("/api/csrf", (req, res) => {
  let token = req.cookies?.csrf_token;
  if (!token) token = crypto.randomBytes(16).toString("hex");
  res.cookie("csrf_token", token, {
    httpOnly: false, // el front lo lee para el header x-csrf-token
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 1000 * 60 * 60 * 12,
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

/* ---------- Admin (lecturas de movimientos de efectivo) ---------- */
app.use("/admin", adminCashRoutes);

/* ---------- API protegidas ---------- */
app.use("/api", pedidos);

// Split (efectivo, saldos, etc.) — protegido con CSRF + rol
app.use("/api/split", requireCsrf, requireWaiter, splitRoutes);
app.use("/api/split", requireCsrf, requireWaiter, cashRoutes);

// Checkout (pasarela) — protegido con CSRF
app.use("/api/checkout", requireCsrf, checkoutRoutes);

/* ---------- Echo ---------- */
app.post("/webhooks/echo", (req, res) => {
  console.log("[ECHO]", new Date().toISOString(), req.headers["user-agent"] || "", req.body);
  res.json({ ok: true, got: req.body });
});

/* ---------- Listen ---------- */
const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server on :${port}`));
