// backend-pasarela/server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import mpPSP from "./src/routes/psp.mercadopago.js";
import culqiPSP from "./src/routes/psp.culqi.js";
import mpPublic from "./src/routes/mp.public.js";
import { getMpKeysForRestaurant } from "./src/services/mpKeys.js";

const app = express();

/* ===== CORS ===== */
const origins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.disable("x-powered-by");
app.set("etag", false);
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || origins.includes(origin)),
    credentials: true,
  })
);
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

/* ===== PING ===== */
app.get("/", (_, res) => res.send("backend-pasarela OK"));

/* ===== DEBUG: token del .env (no multitenant) ===== */
app.get("/__mpdebug", (_, res) => {
  const raw = process.env.MP_ACCESS_TOKEN || "";
  const t = raw.trim();
  res.json({
    len: t.length,
    startsWithTEST: t.startsWith("TEST-"),
    hasWhitespace: /\s/.test(raw),
    tail6: t.slice(-6),
  });
});

/* ===== DEBUG: chequeo del token del .env contra /users/me ===== */
app.get("/__mpcheck", async (_, res) => {
  try {
    const t = (process.env.MP_ACCESS_TOKEN || "").trim();
    const r = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const text = await r.text();
    res.status(r.status).type("application/json").send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===== DEBUG: credenciales por restaurantId (desde Supabase) =====
   GET /__mpcred?restaurantId=1
   - Verifica que publicKey y accessToken coincidan en ambiente (TEST/APP_USR)
   - site_id debe ser MPE para Yape
=================================================================== */
app.get("/__mpcred", async (req, res) => {
  try {
    const rid =
      Number(req.query.restaurantId || req.headers["x-restaurant-id"] || 0);

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
      publicKey_prefix: String(publicKey || "").slice(0, 8), // "TEST-" o "APP_USR"
      accessToken_prefix: String(accessToken || "").slice(0, 7), // "TEST-" o "APP_USR"
      http_status, // 200 si el access token es válido
      site_id: me?.site_id, // Debe ser "MPE" para Yape
      live_mode: me?.live_mode,
      status: me?.status,
      collector_id: me?.id,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ===== RUTAS bajo /api ===== */
app.use("/api", mpPublic); // /api/psp/mp/public-key
app.use("/api", mpPSP);    // /api/psp/mp/preferences, /api/psp/mp/payments/*, /api/psp/mp/webhook
app.use("/api", culqiPSP); // /api/psp/culqi/*

/* ===== START ===== */
const port = process.env.PORT || 5500;
app.listen(port, () => {
  console.log(`pasarela on :${port}`);
  console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
  console.log("BASE_URL    :", process.env.BASE_URL);
  console.log("MP_WEBHOOK_URL:", process.env.MP_WEBHOOK_URL);
  console.log("MP key len  :", (process.env.MP_ACCESS_TOKEN || "").trim().length);
});
