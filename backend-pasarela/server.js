// backend-pasarela/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import mpPSP from "./src/routes/psp.mercadopago.js";
import culqiPSP from "./src/routes/psp.culqi.js";
import mpPublic from "./src/routes/mp.public.js";
import {
  getMpKeysForRestaurant,
  getEnvMpAccessToken,
} from "./src/services/mpKeys.js";

const app = express();

/* ===== CORS (sin wildcard) ===== */
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // Permitir llamadas sin Origin (curl, healthchecks, etc.)
    if (!origin) return cb(null, true);

    if (origins.includes(origin)) {
      return cb(null, true); // origin permitido
    }

    // Origen no permitido => sin CORS
    return cb(new Error("CORS not allowed"), false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Idempotency-Key",
    "x-csrf-token",
    "X-Device-Session-Id",
    "X-Device-Id",
    "X-meli-session-id",

    // 👇 NECESARIOS PARA TU ERROR
    "Cache-Control",
    "Pragma",
    "Accept",
    "X-Requested-With",
  ],
};

app.disable("x-powered-by");
app.set("etag", false);

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ===== HELMET + CSP ===== */
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    // Desactivamos la CSP por defecto de helmet;
    // usaremos solo la política personalizada de abajo
    contentSecurityPolicy: false,
  })
);

// CSP personalizada única para pasarela (ZAP friendly)
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: [
        "'self'",
        "https://api.mercadopago.com",
        "https://api.culqi.com",
      ],
      // Directivas sin fallback que ZAP quiere ver definidas
      frameAncestors: ["'self'"], // anti-clickjacking
      formAction: ["'self'"],     // restringe envío de formularios
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  })
);

// X-Content-Type-Options: nosniff (riesgo bajo #7)
app.use(helmet.noSniff());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  next();
});

app.use(express.json());
app.use(morgan("dev"));

/* ===== PING ===== */
app.get("/", (_, res) => res.send("backend-pasarela OK"));

/* ===== DEBUG: token del .env (no multitenant) ===== */
app.get("/__mpdebug", (_, res) => {
  const raw = getEnvMpAccessToken() || "";
  res.json({
    len: raw.length,
    startsWithTEST: raw.startsWith("TEST-"),
    startsWithAPPUSR: raw.startsWith("APP_USR-"),
    hasWhitespace: /\s/.test(raw),
    tail6: raw.slice(-6),
  });
});

/* ===== DEBUG: chequeo del token del .env contra /users/me ===== */
app.get("/__mpcheck", async (_, res) => {
  try {
    const token = getEnvMpAccessToken();
    if (!token) return res.status(404).json({ error: "MP_ACCESS_TOKEN vacío" });

    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===== DEBUG: credenciales por restaurantId (desde Supabase)
   GET /__mpcred?restaurantId=1
================================================================ */
app.get("/__mpcred", async (req, res) => {
  try {
    const rid = Number(
      req.query.restaurantId || req.headers["x-restaurant-id"] || 0
    );

    const { accessToken, publicKey } = await getMpKeysForRestaurant(rid);
    if (!accessToken && !publicKey) {
      return res
        .status(404)
        .json({ error: "No hay credenciales para ese restaurantId" });
    }

    let me = null;
    let http_status = 0;
    if (accessToken) {
      const r = await fetch("https://api.mercadopago.com/users/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      http_status = r.status;
      try {
        me = await r.json();
      } catch {
        me = null;
      }
    }

    res.json({
      restaurantId: rid,
      publicKey_prefix: String(publicKey || "").slice(0, 8),
      accessToken_prefix: String(accessToken || "").slice(0, 7),
      http_status,
      site_id: me?.site_id,
      live_mode: me?.live_mode,
      status: me?.status,
      collector_id: me?.id,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===== RUTAS bajo /api ===== */
app.use("/api", mpPublic);   // /api/psp/mp/public-key
app.use("/api", mpPSP);      // /api/psp/mp/preferences, /api/psp/mp/payments/*, /api/psp/mp/webhook
app.use("/api", culqiPSP);   // /api/psp/culqi/*

/* ===== START ===== */
const port = Number(process.env.PORT || 5500);
app.listen(port, () => {
  console.log(`pasarela on :${port}`);
  console.log("FRONTEND_URL :", process.env.FRONTEND_URL);
  console.log("BASE_URL     :", process.env.BASE_URL);
  console.log("MP_WEBHOOK_URL:", process.env.MP_WEBHOOK_URL);
  console.log("MP token (.env) len:", (getEnvMpAccessToken() || "").length);
});
