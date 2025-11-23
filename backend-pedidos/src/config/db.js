// backend-pedidos/src/config/db.js
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

// 🔹 Usamos SOLO la cadena normal de Supabase por ahora
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL no está definido en el .env de backend-pedidos"
  );
}

// Número máximo de conexiones en el pool
const max = Number(process.env.PG_MAX || "15"); // 10–15 es sano para Supabase free

export const pool = new Pool({
  connectionString,
  max,
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT || 20_000),   // libera conexiones “viejas”
  connectionTimeoutMillis: Number(process.env.PG_CONN_TIMEOUT || 15_000), // espera más antes de tirar timeout
  keepAlive: true,
  ssl:
    process.env.PG_SSL === "false"
      ? false
      : { rejectUnauthorized: false }, // Supabase
});

// Log de errores inesperados en conexiones
pool.on("error", (err) => {
  console.error("❌ Error inesperado en el pool de Postgres:", err.message);
});

// Test de conexión (libera cliente)
(async () => {
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    console.log(`✅ Conectado a PostgreSQL (pool max=${max})`);
  } catch (err) {
    console.error("❌ Error de conexión:", err);
  }
})();
