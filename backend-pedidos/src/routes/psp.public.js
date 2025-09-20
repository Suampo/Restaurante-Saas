// backend-pedidos/src/routes/psp.public.js
import express from "express";

const router = express.Router();

/** Base de la pasarela :5500 con /api (configurada en .env) */
const PASARELA_BASE =
  process.env.PSP_API_URL ||
  process.env.API_PASARELA_URL ||
  "http://localhost:5500/api";

/** Utilidad de proxy JSON simple */
async function proxyJson(req, res, path, { method = "GET", bodyObj = null } = {}) {
  const url = `${PASARELA_BASE.replace(/\/+$/, "")}${path}`;
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  const idem = req.get("X-Idempotency-Key");
  if (idem) headers["X-Idempotency-Key"] = idem;

  const fetchOpts = { method, headers };
  if (bodyObj) fetchOpts.body = JSON.stringify(bodyObj);

  try {
    const r = await fetch(url, fetchOpts);
    const text = await r.text();
    res.status(r.status);
    try { return res.json(JSON.parse(text)); }
    catch { return res.type("application/json").send(text); }
  } catch (e) {
    console.error("[PSP proxy error]", method, path, e);
    return res.status(502).json({ error: "Pasarela no disponible" });
  }
}

/** GET /api/psp/mp/public-key?restaurantId=2 */
router.get("/psp/mp/public-key", async (req, res) => {
  const restaurantId = Number(req.query.restaurantId || 0);
  if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });
  const urlPath = `/psp/mp/public-key?restaurantId=${restaurantId}`;
  return proxyJson(req, res, urlPath, { method: "GET" });
});

/** POST /api/psp/mp/preferences */
router.post("/psp/mp/preferences", async (req, res) => {
  return proxyJson(req, res, "/psp/mp/preferences", {
    method: "POST",
    bodyObj: req.body || {},
  });
});

/** POST /api/psp/mp/payments/yape */
router.post("/psp/mp/payments/yape", async (req, res) => {
  return proxyJson(req, res, "/psp/mp/payments/yape", {
    method: "POST",
    bodyObj: req.body || {},
  });
});

/** POST /api/psp/mp/payments/card */
router.post("/psp/mp/payments/card", async (req, res) => {
  return proxyJson(req, res, "/psp/mp/payments/card", {
    method: "POST",
    bodyObj: req.body || {},
  });
});

export default router;
