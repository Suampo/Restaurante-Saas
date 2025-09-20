// src/services/pspService.js
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
});

export async function getCulqiWebhookSecret(restaurantId) {
  // 1) psp_credentials.webhook_secret (preferido)
  if (restaurantId) {
    try {
      const q = await pool.query(
        `SELECT webhook_secret
         FROM psp_credentials
         WHERE restaurant_id=$1 AND provider='culqi' AND active IS TRUE
         ORDER BY id DESC LIMIT 1`,
        [Number(restaurantId)]
      );
      const s = (q.rows?.[0]?.webhook_secret || "").trim();
      if (s) return s;
    } catch {}
  }
  // 2) Fallback .env
  return (process.env.CULQI_SECRET || process.env.CULQI_SECRET_KEY || "").trim();
}
