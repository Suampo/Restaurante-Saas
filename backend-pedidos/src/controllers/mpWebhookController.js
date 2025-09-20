// src/controllers/mpWebhookController.js
import { Pool } from "pg";
import { MercadoPagoConfig, Payment } from "mercadopago";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

// lee access token de la tabla psp_credentials; fallback .env
async function getMpAccessTokenForRestaurant(restaurantId) {
  const rid = Number(restaurantId || 0) || null;
  if (rid) {
    try {
      const q = await pool.query(
        `SELECT secret_key
           FROM psp_credentials
          WHERE restaurant_id=$1 AND provider='mercadopago' AND active IS TRUE
          ORDER BY id DESC LIMIT 1`,
        [rid]
      );
      const k = (q.rows?.[0]?.secret_key || "").trim();
      if (k) return k;
    } catch {}
  }
  return (process.env.MP_ACCESS_TOKEN || "").trim();
}

function extractIdFromResource(resource) {
  if (!resource) return null;
  const parts = String(resource).split("/");
  return parts[parts.length - 1] || null;
}

export async function mpWebhook(req, res) {
  try {
    const payload = req.body || {};
    const type = (payload.type || payload.action || "").toLowerCase();

    // resolvemos el id del pago notificado
    const dataId =
      payload?.data?.id ||
      extractIdFromResource(payload?.resource) ||
      null;

    // opcionalmente llega ?restaurantId= en la URL
    const restaurantIdHint = Number(req.query.restaurantId || 0) || null;

    if (!type.includes("payment") || !dataId) {
      return res.sendStatus(200); // ignoramos otros eventos
    }

    // 1) intentamos con token por restaurante
    const token1 = await getMpAccessTokenForRestaurant(restaurantIdHint);
    const mp1 = new MercadoPagoConfig({ accessToken: token1 });

    let payment;
    try {
      payment = await new Payment(mp1).get({ id: dataId });
    } catch (e1) {
      // 2) fallback al .env si falló con el token1
      const token2 = (process.env.MP_ACCESS_TOKEN || "").trim();
      if (!token2 || token2 === token1) {
        return res.sendStatus(200);
      }
      try {
        payment = await new Payment(new MercadoPagoConfig({ accessToken: token2 })).get({ id: dataId });
      } catch {
        return res.sendStatus(200);
      }
    }

    const status = payment?.status || "";
    const pedidoId =
      Number(payment?.metadata?.pedidoId || payment?.metadata?.pedido_id || 0) ||
      (payment?.external_reference ? Number(payment.external_reference) : null);

    const rid =
      restaurantIdHint ||
      Number(payment?.metadata?.restaurantId || payment?.metadata?.restaurant_id || 0) ||
      null;

    const orderId = payment?.order?.id || null;

    // guardamos log/idempotencia en "pagos"
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO pagos
           (pedido_id, monto, metodo, estado, transaction_id, created_at,
            restaurant_id, psp, psp_event_id, psp_order_id, currency, psp_payload)
         VALUES ($1,$2,$3,$4,$5, now(), $6, 'mp', $7, $8, $9, $10)
         ON CONFLICT (restaurant_id, psp, psp_event_id)
           WHERE psp_event_id IS NOT NULL
           DO NOTHING`,
        [
          pedidoId || null,
          payment?.transaction_amount ?? null,
          payment?.payment_method_id || null,
          status || null,
          String(payment?.id || dataId),
          rid,
          String(payment?.id || dataId),
          orderId ? String(orderId) : null,
          payment?.currency_id || "PEN",
          payment || null,
        ]
      );

      if (status === "approved" && pedidoId) {
        await client.query(
          `UPDATE pedidos
              SET estado='pagado', updated_at=now()
            WHERE id=$1 AND estado <> 'pagado'`,
          [pedidoId]
        );
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }

    return res.sendStatus(200);
  } catch (e) {
    return res.sendStatus(200); // evitar reintentos agresivos
  }
}
