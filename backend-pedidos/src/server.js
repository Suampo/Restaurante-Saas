// backend-pedidos/src/server.js
import "./loadEnv.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import crypto from "crypto";
import { imgRouter } from "./routes/img.js";

/* ===== Rutas (estables) ===== */
import pspPublicRoutes from "./routes/psp.public.js";
import authPublicRoutes from "./routes/auth.public.js";
import sessionLoginRoutes from "./routes/session.js";
import sessionCookieRoutes from "./routes/sessionRoutes.js";
import checkoutRoutes from "./routes/checkout.routes.js";
import devRoutes from "./routes/devRoutes.js";
import takeawayRoutes from "./routes/takeaway.routes.js";
import publicMesas from "./routes/public.mesas.js";
import combosRoutes from "./routes/combosRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import pedidoRoutes from "./routes/pedidoRoutes.js";
import publicMenuRoutes from "./routes/public.menu.js";
import publicMenuV2Routes from "./routes/public.menu.v2.js";
import restaurantsPublic from "./routes/public.restaurants.js";
import authRoutes from "./routes/authRoutes.js";
import mesaRoutes from "./routes/mesaRoutes.js";
import menuImageRoutes from "./routes/menuImageRoutes.js";
import payRoutes from "./routes/payRoutes.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import categoriaRoutes from "./routes/categoriaRoutes.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import exportRoutes from "./routes/export.js";
import staffRoutes from "./routes/staff.routes.js";

import healthRoutes from "./routes/healthRoutes.js";
/* ✅ INVENTARIO */
import inventarioRoutes from "./routes/inventarioRoutes.js";

/* ✅ NUEVO: Admin – movimientos de efectivo (para vista Trabajadores) */
import adminCashRoutes from "./routes/admin.cash.js";
/* ✅ NUEVO: Admin – configuración de restaurante */
import restaurantAdminRoutes from "./routes/admin.restaurant.js";

/* ===== Middlewares ===== */
import { requireCsrf } from "./middlewares/requireCsrf.js";
import { requireDbToken } from "./middlewares/requireDbToken.js";
import { initSocket } from "./services/realtimeService.js";

const app = express();
const isProd = process.env.NODE_ENV === "production";

/* ===== Infra ===== */
app.set("trust proxy", 1);
app.set("etag", false);

/* ===== Seguridad base ===== */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "script-src-attr": ["'none'"],
        "style-src": ["'self'"], // 🚫 sin unsafe-inline
        "img-src": ["'self'", "data:"],
        "font-src": ["'self'", "https:", "data:"],
        "object-src": ["'none'"],
        "frame-ancestors": ["'self'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
      },
    },
  })
);

/* ===== CORS ===== */
const defaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5500",
  "http://localhost:5174",
  "http://localhost:5175",
];
const envOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const allowlist = [...new Set([...defaultOrigins, ...envOrigins])];

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // Postman/cURL
      return allowlist.includes(origin)
        ? cb(null, true)
        : cb(new Error("CORS: Origin no permitido"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
    maxAge: 86400,
    exposedHeaders: ["Content-Disposition"],
  })
);

/* ===== Cookies antes de CSRF ===== */
app.use(cookieParser());

/**
 * Siembra CSRF si falta (cookie legible por el front).
 */
app.use((req, res, next) => {
  if (!req.cookies?.csrf_token) {
    const token = crypto.randomBytes(24).toString("hex");
    res.cookie("csrf_token", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: isProd,
      path: "/api",
      maxAge: 1000 * 60 * 60 * 12,
    });
  }
  next();
});

/* ===== Body parsers ===== */
app.use(compression());
app.use((req, res, next) => {
  if (req.path === "/api/webhooks/culqi") {
    return express.raw({ type: "application/json", limit: "1mb" })(
      req,
      res,
      next
    );
  }
  return express.json({ limit: "1mb" })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ===== /img (optimización) ANTES de CSRF ===== */
app.use("/img", imgRouter);

/* ===== CSRF (double-submit cookie) ===== */
app.use(requireCsrf);

/* ===== Cache headers ===== */
app.use((req, res, next) => {
  if (req.path && req.path.startsWith("/api/reportes")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});
app.use((req, res, next) => {
  if (req.path === "/api/auth/validate-cookie") {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const p = req.path || "";
  if (p.startsWith("/api/categorias")) {
    res.set("Cache-Control", "no-store");
    return next();
  }
  const cacheables = [
    "/api/inventario/unidades",
    "/api/inventario/almacenes",
  ];
  if (cacheables.some((prefix) => p.startsWith(prefix))) {
    if (!res.get("Cache-Control")) {
      res.set(
        "Cache-Control",
        "public, max-age=60, stale-while-revalidate=30"
      );
    }
  }
  next();
});

/* ===== Rate limits ===== */
const isProdLimits = isProd;
const baseLimiter = rateLimit({
  windowMs: 60_000,
  max: isProdLimits ? 300 : 10_000,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    console.warn("[RateLimit]", req.method, req.originalUrl, "ip:", req.ip);
    res.status(429).json({ error: "Too Many Requests" });
  },
});
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: isProdLimits ? 30 : 2_000,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    console.warn(
      "[RateLimit AUTH]",
      req.method,
      req.originalUrl,
      "ip:",
      req.ip
    );
    res.status(429).json({ error: "Too Many Requests" });
  },
});
const webhookLimiter = rateLimit({
  windowMs: 60_000,
  max: isProdLimits ? 60 : 5_000,
});

// Rate-limit específico para crear pedido (público)
const createPedidoLimiter = rateLimit({
  windowMs: 60_000,
  max: isProdLimits ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
});

if (isProdLimits) {
  app.use("/api/", baseLimiter);
  app.use("/api/auth", (req, res, next) => {
    if (req.path === "/validate-cookie") return next();
    return authLimiter(req, res, next);
  });
  app.use("/api/webhooks", webhookLimiter);
}

/* ===== RUTAS PÚBLICAS (orden importa) ===== */
app.use("/api/staff", requireDbToken, staffRoutes);

app.use("/api", publicMesas); // GET /api/public/mesas/resolve
app.use("/api", restaurantsPublic); // GET /api/public/restaurants/:id
app.use("/api", publicMenuRoutes); // GET /api/public/menu
app.use("/api", sessionCookieRoutes); // /api/csrf + /api/session/refresh + /api/auth/*
app.use("/api", sessionLoginRoutes); // /api/session/login
app.use("/api", authPublicRoutes);
app.use("/api", pspPublicRoutes);
app.use("/api/pay", payRoutes);
app.use("/api/dev", devRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api", publicMenuV2Routes); // GET /api/public/menu-v2
app.use("/api", takeawayRoutes);
app.use("/api", healthRoutes);

/* ===== RUTAS PROTEGIDAS / MIXTAS ===== */

// Pedidos: POST raíz público con rate-limit; resto con token
const guardPedidos = (req, res, next) => {
  const isRoot = req.path === "/" || req.path === "";
  if (req.method === "POST" && isRoot) {
    return createPedidoLimiter(req, res, () => next());
  }
  return requireDbToken(req, res, next);
};
app.use("/api/pedidos", guardPedidos, pedidoRoutes);

// Inventario
app.use("/api/inventario", requireDbToken, inventarioRoutes);

// El resto protegido
// app.use("/api/auth", requireDbToken, authRoutes);
app.use("/api/auth", authRoutes);

/* ✅ NUEVO: configuración de restaurante (GET/PUT /api/restaurant) */
app.use("/api/restaurant", requireDbToken, restaurantAdminRoutes);

app.use("/api/menu", requireDbToken, menuRoutes);
app.use("/api/mesas", requireDbToken, mesaRoutes);
app.use("/api/menu-item", requireDbToken, menuImageRoutes);
app.use("/api/menu-items", requireDbToken, menuItemRoutes);
app.use("/api/combos", requireDbToken, combosRoutes);
app.use("/api/categorias", requireDbToken, categoriaRoutes);
app.use("/api/reportes", requireDbToken, reportesRoutes);
app.use("/api", requireDbToken, exportRoutes);

/* ✅ ADMIN (para “Trabajadores”) */
app.use("/admin", requireDbToken, adminCashRoutes);

/* ===== Estáticos ===== */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/menu_images", express.static(path.join(__dirname, "menu_images")));
/* ===== 404 + errores ===== */
app.use((req, res) => res.status(404).json({ error: "No encontrado" }));

app.use((err, req, res, _next) => {
  console.error("[ERR HANDLER]", {
    message: err.message,
    code: err.code,
    stack: err.stack,
    path: `${req.method} ${req.originalUrl}`,
  });

  if (res.headersSent) {
    return;
  }

  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Error interno" });
});

/* ===== HTTP + Socket.IO ===== */
const server = http.createServer(app);
import { initSocket as _initSocket } from "./services/realtimeService.js";
_initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(
    `✅ Servidor corriendo en http://localhost:${PORT} (${
      isProd ? "prod" : "dev"
    })`
  );
});
