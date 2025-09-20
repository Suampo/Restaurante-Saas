// src/routes/psp.mercadopago.public.js
import { Router } from "express";
import { Pool } from "pg";

const router = Router();

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

/* ======================== Helpers ======================== */
async function getMpKeys(restaurantId) {
  const rid = Number(restaurantId || 0) || null;
  const fallback = {
    publicKey: (process.env.MP_PUBLIC_KEY || "").trim(),
    accessToken: (process.env.MP_ACCESS_TOKEN || "").trim(),
  };
  if (!rid) return fallback;

  // 1) psp_credentials (provider='mercadopago')
  try {
    const q = await pool.query(
      `SELECT public_key, secret_key
       FROM psp_credentials
       WHERE restaurant_id=$1 AND provider='mercadopago' AND active IS TRUE
       ORDER BY id DESC LIMIT 1`,
      [rid]
    );
    if (q.rowCount) {
      return {
        publicKey: (q.rows[0].public_key || fallback.publicKey).trim(),
        accessToken: (q.rows[0].secret_key || fallback.accessToken).trim(),
      };
    }
  } catch (e) {
    console.error("[mp.getMpKeys > psp_credentials] err:", e.message);
  }

  // 2) restaurantes(public_key, secret_key)
  try {
    const q2 = await pool.query(
      `SELECT public_key, secret_key
       FROM restaurantes
       WHERE id=$1 LIMIT 1`,
      [rid]
    );
    if (q2.rowCount) {
      return {
        publicKey: (q2.rows[0].public_key || fallback.publicKey).trim(),
        accessToken: (q2.rows[0].secret_key || fallback.accessToken).trim(),
      };
    }
  } catch (e) {
    console.error("[mp.getMpKeys > restaurantes] err:", e.message);
  }

  return fallback;
}

/* ================== 1) PUBLIC KEY (front) ================== */
router.get("/psp/mp/public-key", async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const { publicKey } = await getMpKeys(restaurantId);
    if (!publicKey) return res.status(500).json({ error: "No hay public_key configurada" });
    res.json({ publicKey });
  } catch (e) {
    console.error("[mp.public-key] err:", e);
    res.status(500).json({ error: "Error obteniendo public key" });
  }
});

/* ============= 2) Pago Yape (demo y real simplificado) ============= */
/**
 * Body esperado:
 * {
 *   token?: string,            // si integras Yape token real
 *   phone?: "111111111",       // demo
 *   otp?:   "123456",          // demo
 *   amount: number,            // S/ (no centavos)
 *   email?: string,
 *   description?: string,
 *   metadata: { pedidoId: number, restaurantId: number }
 * }
 */
router.post("/psp/mp/payments/yape", async (req, res) => {
  try {
    const { token, phone, otp, amount, email, description, metadata } = req.body || {};
    const allowMock = String(process.env.ALLOW_MOCK_PAY).toLowerCase() === "true";
    const rid = Number(metadata?.restaurantId || 0) || null;
    const pedidoId = Number(metadata?.pedidoId || 0) || null;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "amount es requerido" });
    }

    // DEMO Yape (sin token) 111111111 / 123456
    const demoPhone = String(process.env.YAPE_DEMO_PHONE || "111111111");
    const demoOtp   = String(process.env.YAPE_DEMO_OTP   || "123456");

    const isDemo = !token;
    if (isDemo && !allowMock) {
      return res.status(400).json({ error: "token requerido (modo demo deshabilitado)" });
    }
    if (isDemo && !(String(phone) === demoPhone && String(otp) === demoOtp)) {
      return res.status(400).json({ error: "token y amount son requeridos" });
    }

    // Simulamos respuesta aprobada
    const approvedResp = {
      id: isDemo ? `yape_demo_${Date.now()}` : `yape_${Date.now()}`,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: amt,
      description: description || null,
    };

    // === Transacción: guardar pago + marcar pedido 'pagado'
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO pagos
          (pedido_id, monto, metodo, estado, transaction_id, created_at,
           restaurant_id, psp, psp_event_id, currency, psp_payload)
         VALUES ($1,$2,$3,$4,$5, now(), $6, $7, $8, $9, $10)`,
        [
          pedidoId || null,
          amt,
          "yape",
          "approved",
          approvedResp.id,
          rid,
          "mp",
          approvedResp.id,     // psp_event_id
          "PEN",
          { demo: isDemo, phone, otp, email, metadata },
        ]
      );

      if (pedidoId) {
        await client.query(
          `UPDATE pedidos
             SET estado='pagado', updated_at=now()
           WHERE id=$1 AND estado <> 'pagado'`,
          [pedidoId]
        );
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      console.error("[psp.mp.yape.tx] err:", txErr);
      return res.status(500).json({ error: "No se pudo registrar el pago" });
    } finally {
      client.release();
    }

    return res.json(approvedResp);
  } catch (e) {
    console.error("[psp.mp.yape] err:", e);
    res.status(500).json({ error: "Error procesando Yape" });
  }
});

/* ============= 3) Tarjeta (demo) — si usas Brick sin tokenizar ============= */
/**
 * Body:
 * {
 *   amount: number,              // S/
 *   formData: { ... },           // lo que devuelva el Brick
 *   description?: string,
 *   metadata: { pedidoId: number, restaurantId: number }
 * }
 */
router.post("/psp/mp/payments/card", async (req, res) => {
  try {
    const { amount, formData, description, metadata } = req.body || {};
    const rid = Number(metadata?.restaurantId || 0) || null;
    const pedidoId = Number(metadata?.pedidoId || 0) || null;

    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: "amount es requerido" });
    }

    const approvedResp = {
      id: `card_demo_${Date.now()}`,
      status: "approved",
      status_detail: "accredited",
      transaction_amount: amt,
      description: description || null,
    };

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO pagos
          (pedido_id, monto, metodo, estado, transaction_id, created_at,
           restaurant_id, psp, psp_event_id, currency, psp_payload)
         VALUES ($1,$2,$3,$4,$5, now(), $6, $7, $8, $9, $10)`,
        [
          pedidoId || null,
          amt,
          (formData?.payment_method_id || "card"),
          "approved",
          approvedResp.id,
          rid,
          "mp",
          approvedResp.id,
          "PEN",
          { formData, description, metadata },
        ]
      );

      if (pedidoId) {
        await client.query(
          `UPDATE pedidos
             SET estado='pagado', updated_at=now()
           WHERE id=$1 AND estado <> 'pagado'`,
          [pedidoId]
        );
      }

      await client.query("COMMIT");
    } catch (txErr) {
      await client.query("ROLLBACK");
      console.error("[psp.mp.card.tx] err:", txErr);
      return res.status(500).json({ error: "No se pudo registrar el pago" });
    } finally {
      client.release();
    }

    return res.json(approvedResp);
  } catch (e) {
    console.error("[psp.mp.card] err:", e);
    res.status(500).json({ error: "Error procesando tarjeta" });
  }
});

export default router;
