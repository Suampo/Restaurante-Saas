// src/db.js
const { Pool } = require('pg');

// Usa DATABASE_URL (cadena completa) o variables PG* por separado
const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL || // si la tienes
  `postgresql://${process.env.PGUSER || 'postgres'}:${encodeURIComponent(process.env.PGPASSWORD || '')}` +
  `@${process.env.PGHOST || 'localhost'}:${process.env.PGPORT || 5432}/${process.env.PGDATABASE || 'postgres'}`;

// SSL automático si es Supabase/Heroku/etc. o si fuerzas DB_SSL=true
const ssl =
  process.env.DB_SSL === 'true' || /supabase|render|heroku|fly|railway/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : false;

const pool = new Pool({
  connectionString,
  ssl,
  max: Number(process.env.PGPOOL_MAX || 10),
});

pool.on('error', (err) => {
  console.error('[pg] Pool error', err);
});

module.exports = pool;
