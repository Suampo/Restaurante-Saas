// src/controllers/payController.js
import { pool } from "../config/db.js";
import { nanoid } from "nanoid";
import { createCulqiOrder, createCulqiCharge } from "../services/culqiService.js";

/** Normaliza/deriva metadata requerida por Culqi */
async function buildMetadata(req) {
  const rid = Number(req?.user?.restaurantId || 0) || null;
  let md = { ...(req.body?.metadata || {}) };

  // mesa_id: body.mesaId|mesa_id o metadata.mesa_id
  const bodyMesaId = req.body?.mesaId ?? req.body?.mesa_id ?? null;
  if (bodyMesaId != null && md.mesa_id == null) md.mesa_id = Number(bodyMesaId);
  else if (md.mesa_id != null) md.mesa_id = Number(md.mesa_id);

  // table_code: body.table_code|mesaCode o metadata.table_code
  const bodyTableCode = req.body?.table_code ?? req.body?.mesaCode ?? null;
  if (typeof bodyTableCode === "string" && !md.table_code) md.table_code = bodyTableCode.trim();
  else if (typeof md.table_code === "string") md.table_code = md.table_code.trim();

  // order_id: body.pedidoId|order_id o metadata.order_id
  const bodyOrderId = req.body?.pedidoId ?? req.body?.order_id ?? null;
  if (bodyOrderId != null && md.order_id == null) md.order_id = Number(bodyOrderId);
  else if (md.order_id != null) md.order_id = Number(md.order_id);

  // idempotency_key (opcional)
  if (typeof req.body?.idempotencyKey === "string" && !md.idempotency_key) {
    md.idempotency_key = req.body.idempotencyKey.trim();
  } else if (typeof md.idempotency_key === "string") {
    md.idempotency_key = md.idempotency_key.trim();
  }

  // fuerza tenant
  if (rid) md.restaurant_id = rid;

  // si ya tenemos table_code, listo
  if (md.table_code) return md;

  // derivar por mesa_id
  if (rid && md.mesa_id) {
    const r = await pool.query(
      "SELECT codigo FROM mesas WHERE id=$1 AND restaurant_id=$2",
      [md.mesa_id, rid]
    );
    if (r.rowCount) {
      md.table_code = String(r.rows[0].codigo).trim();
      return md;
    }
  }

  // derivar por order_id
  if (rid && md.order_id) {
    const r = await pool.query(
      `SELECT m.codigo, p.mesa_id
         FROM pedidos p
         JOIN mesas m ON m.id = p.mesa_id
        WHERE p.id = $1 AND p.restaurant_id = $2`,
      [md.order_id, rid]
    );
    if (r.rowCount) {
      md.table_code = String(r.rows[0].codigo).trim();
      md.mesa_id = Number(r.rows[0].mesa_id);
      return md;
    }
  }

  return md;
}

/** POST /api/pay/culqi/order */
export async function apiCreateCulqiOrder(req, res) {
  try {
    const { amount, email, description, paymentMethods } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: "Monto inválido" });
    if (!req.user?.restaurantId) return res.status(401).json({ error: "Auth inválida" });

    const metadata = await buildMetadata(req);
    if (!metadata.table_code) {
      return res.status(400).json({
        error: "Falta metadata.table_code",
        detail: "Envía table_code o mesaId/order_id para derivarlo",
      });
    }

    const order = await createCulqiOrder({
      amount,
      currency: "PEN",
      description,
      email,
      metadata,
      paymentMethods, // { card:true, yape:true } opcional
    });

    res.json({ order });
  } catch (e) {
    console.error("apiCreateCulqiOrder:", e.message);
    res.status(500).json({ error: "No se pudo crear la orden", detail: e.message });
  }
}

/** POST /api/pay/culqi/charge */
export async function apiCreateCulqiCharge(req, res) {
  try {
    const { amount, email, tokenId, description } = req.body;
    if (!amount || amount <= 0 || !tokenId) {
      return res.status(400).json({ error: "Faltan parámetros" });
    }
    if (!req.user?.restaurantId) return res.status(401).json({ error: "Auth inválida" });

    const metadata = await buildMetadata(req);
    if (!metadata.table_code) {
      return res.status(400).json({
        error: "Falta metadata.table_code",
        detail: "Envía table_code o mesaId/order_id para derivarlo",
      });
    }

    const charge = await createCulqiCharge({
      amount,
      currency: "PEN",
      email,
      tokenId,
      description,
      metadata,
    });

    res.json({ charge });
  } catch (e) {
    console.error("apiCreateCulqiCharge:", e.message);
    res.status(500).json({ error: "No se pudo crear el cargo", detail: e.message });
  }
}
// ======== BYO keys (público: comensal) ========

/** Carga llaves Culqi desde DB del restaurante */
async function getRestaurantKeysById(rid) {
  const r = await pool.query(
    "SELECT id, nombre, public_key, secret_key FROM public.restaurantes WHERE id=$1",
    [Number(rid)]
  );
  const row = r.rows?.[0];
  if (!row) throw new Error("Restaurante no encontrado");
  if (!row.public_key || !row.secret_key) {
    const e = new Error("Restaurante sin llaves Culqi configuradas");
    e.code = "NO_KEYS";
    throw e;
  }
  return row;
}

async function buildPublicMetadata(req) {
  const restaurantId = Number(req.params.restaurantId);
  let md = { ...(req.body?.metadata || {}) };

  const mesaId = req.body?.mesaId ?? req.body?.mesa_id ?? md.mesa_id ?? null;
  if (mesaId != null) md.mesa_id = Number(mesaId);

  const orderId = req.body?.pedidoId ?? req.body?.order_id ?? md.order_id ?? null;
  if (orderId != null) md.order_id = Number(orderId);

  if (typeof req.body?.table_code === "string" && !md.table_code) md.table_code = req.body.table_code.trim();

  md.restaurant_id = restaurantId;

  if (md.table_code) return md;

  if (restaurantId && md.mesa_id) {
    const r = await pool.query("SELECT codigo FROM mesas WHERE id=$1 AND restaurant_id=$2", [md.mesa_id, restaurantId]);
    if (r.rowCount) md.table_code = String(r.rows[0].codigo).trim();
  }

  if (restaurantId && !md.table_code && md.order_id) {
    const r = await pool.query(
      `SELECT m.codigo, p.mesa_id
         FROM pedidos p
         JOIN mesas m ON m.id = p.mesa_id AND m.restaurant_id = p.restaurant_id
        WHERE p.id = $1 AND p.restaurant_id = $2`,
      [md.order_id, restaurantId]
    );
    if (r.rowCount) {
      md.table_code = String(r.rows[0].codigo).trim();
      md.mesa_id = Number(r.rows[0].mesa_id);
    }
  }
  return md;
}

/** GET /api/pay/public/:restaurantId/config */
export async function getPublicConfig(req, res) {
  try {
    const { restaurantId } = req.params;
    const r = await getRestaurantKeysById(restaurantId);
    return res.json({ tenantId: r.id, name: r.nombre, culqiPublicKey: r.public_key });
  } catch (err) {
    return res.status(err.code === "NO_KEYS" ? 400 : 404).json({ error: err.message });
  }
}

/** POST /api/pay/public/:restaurantId/checkout/prepare  → { culqi: { orderId } } */
export async function preparePublicOrder(req, res) {
  try {
    const { restaurantId } = req.params;
    let { amount, email, description, paymentMethods } = req.body || {};
    if (!amount || amount <= 0) return res.status(400).json({ error: "Monto inválido" });
    if (!email) email = `guest+${Date.now()}@${process.env.PUBLIC_EMAIL_DOMAIN || "noemail.local"}`;

    const r  = await getRestaurantKeysById(restaurantId);
    const md = await buildPublicMetadata(req);
    if (!md.table_code) md.table_code = process.env.PUBLIC_DEFAULT_TABLE_CODE || "ONLINE";

    const order = await createCulqiOrder({
      amount,
      currency: "PEN",
      description,
      email,
      metadata: md,
      paymentMethods,      // { tarjeta:true, yape:true, bancaMovil:true }
      secretKey: r.secret_key,
    });

    return res.json({ culqi: { orderId: order.id } });
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ error: e.message, culqi: e.culqi || null });
  }
}

/** POST /api/pay/public/:restaurantId/checkout/charge  → { ok, chargeId } */
export async function chargePublicToken(req, res) {
  try {
    const { restaurantId } = req.params;
    let { amount, email, tokenId, description } = req.body || {};
    if (!email) email = `guest+${Date.now()}@${process.env.PUBLIC_EMAIL_DOMAIN || "noemail.local"}`;
    if (!amount || amount <= 0 || !tokenId) return res.status(400).json({ error: "Faltan parámetros" });

    const r  = await getRestaurantKeysById(restaurantId);
    const md = await buildPublicMetadata(req);
    if (!md.table_code) {
      return res.status(400).json({ error: "Falta metadata.table_code", detail: "Envía table_code o mesaId/order_id" });
    }

    const charge = await createCulqiCharge({
      amount,
      currency: "PEN",
      email,
      tokenId,
      description,
      metadata: md,
      secretKey: r.secret_key,
    });

    return res.json({ ok: true, chargeId: charge.id });
  } catch (e) {
    const status = e?.status || 500;
    return res.status(status).json({ error: e.message, culqi: e.culqi || null });
  }
}
