import express from "express";
import { culqi, authHeaders } from "../utils/http.js";

// (Si luego quieres multitenant, aquí resuelves la llave por restaurantId)
function getCulqiKeys(/* restaurantId */) {
  return {
    publicKey: process.env.CULQI_PUBLIC_KEY,
    secretKey: process.env.CULQI_SECRET_KEY
  };
}

const router = express.Router();

/**
 * POST /psp/culqi/orders
 * Body: { amount, currency, email, description, metadata, idempotencyKey }
 * Nota: tu comercio hoy no tiene ORDERS habilitado → Culqi responde 400.
 * Este endpoint simplemente propaga el error para que el front caiga a tarjeta.
 */
router.post("/psp/culqi/orders", async (req, res) => {
  try {
    const {
      amount = 0,
      currency = "PEN",
      email,
      description = "Pedido",
      metadata = {},
      idempotencyKey,
      restaurantId
    } = req.body || {};

    if (!amount || !email) {
      return res.status(400).json({ error: "amount y email son requeridos" });
    }

    const { secretKey } = getCulqiKeys(restaurantId);
    const payload = {
      amount: Number(amount),
      currency_code: currency,
      description,
      order_number: String(metadata.orderId || ""),
      client_details: { email },
      metadata
    };

    const out = await culqi.post("/orders", payload, authHeaders(secretKey, idempotencyKey));
    return res.status(200).json(out.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
});

/**
 * POST /psp/culqi/charges
 * Body: { amount, currency, email, tokenId, description, metadata, idempotencyKey }
 * Crea cargo con token (tarjeta).
 */
router.post("/psp/culqi/charges", async (req, res) => {
  try {
    const {
      amount = 0,
      currency = "PEN",
      email,
      tokenId,
      description = "Pedido",
      metadata = {},
      idempotencyKey,
      restaurantId
    } = req.body || {};

    if (!amount || !email || !tokenId) {
      return res.status(400).json({ error: "amount, email y tokenId son requeridos" });
    }

    const { secretKey } = getCulqiKeys(restaurantId);
    const payload = {
      amount: Number(amount),
      currency_code: currency,
      email,
      source_id: tokenId,
      description,
      metadata
    };

    const out = await culqi.post("/charges", payload, authHeaders(secretKey, idempotencyKey));
    return res.status(200).json(out.data);
  } catch (err) {
    const status = err?.response?.status || 500;
    const data = err?.response?.data || { error: err.message };
    return res.status(status).json(data);
  }
});

export default router;
