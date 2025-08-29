import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import devRoutes from "./routes/devRoutes.js";
import combosRoutes from "./routes/combosRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import pedidoRoutes from "./routes/pedidoRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import restaurantsPublic from "./routes/public.restaurants.js";
import authRoutes from "./routes/authRoutes.js";
import mesaRoutes from "./routes/mesaRoutes.js";
import adminCombosCover from "./routes/admin.combos.cover.js";
import menuImageRoutes from "./routes/menuImageRoutes.js";
import payRoutes from "./routes/payRoutes.js";
import menuItemRoutes from "./routes/menuItemRoutes.js";
import categoriaRoutes from "./routes/categoriaRoutes.js";
import { initSocket } from "./services/realtimeService.js";
import reportesRoutes from "./routes/reportesRoutes.js";
import inventarioRoutes from "./routes/inventarioRoutes.js";
const app = express();

// Conf para PaaS/Proxies (X-Forwarded-*)
app.set("trust proxy", 1);

// ===== Seguridad base =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, // sirve estáticos a tus frontends
  })
);

// CORS estricto (orígenes desde ENV + localhost)
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
  })
);

// Rate limits (ajusta a tu gusto)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
const webhookLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });

app.use("/api/", apiLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/webhooks", webhookLimiter);
app.use(restaurantsPublic);
// Compresión y body size limits
app.use(compression());

// 👉 Culqi necesita RAW BODY para validar firma
app.use("/api/webhooks/culqi", express.raw({ type: "*/*", limit: "1mb" }));

// Resto JSON/URL-Encoded
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== Rutas API =====
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/mesas", mesaRoutes);
app.use("/api/pedidos", pedidoRoutes);
app.use("/api/webhooks", webhookRoutes); // incluye /culqi
app.use("/api/dev", devRoutes);          // 👈 solo para pruebas
app.use("/api/menu-item", menuImageRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/combos", combosRoutes);
app.use("/api/inventario", inventarioRoutes);
app.use("/api/pay", payRoutes);
app.use("/api/categorias", categoriaRoutes);
app.use("/api/reportes", reportesRoutes);
app.use(adminCombosCover);
// Estáticos
app.use(express.static(path.join(__dirname, "public")));

// Home (panel cocina)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cocina.html"));
});

// 404 y manejador de errores
app.use((req, res) => res.status(404).json({ error: "No encontrado" }));
app.use((err, req, res, _next) => {
  console.error("[ERR]", err.message);
  res
    .status(err.status || 500)
    .json({ error: err.status ? err.message : "Error interno" });
});

// HTTP + Socket.IO
const server = http.createServer(app);
initSocket(server);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
});
