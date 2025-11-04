// scripts/migrar-passwords.js
import 'dotenv/config'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })

async function main() {
  const client = await pool.connect()
  try {
    await client.query(`
      ALTER TABLE public.usuarios
      ADD COLUMN IF NOT EXISTS password_hash text;
    `)

    const { rows } = await client.query(`
      SELECT id, password
      FROM public.usuarios
      WHERE password IS NOT NULL
        AND (password_hash IS NULL OR password_hash = '')
    `)

    for (const r of rows) {
      const hash = await bcrypt.hash(String(r.password), 12)
      await client.query(
        `UPDATE public.usuarios SET password_hash = $1 WHERE id = $2`,
        [hash, r.id]
      )
      console.log('Hasheado usuario id=', r.id)
    }

    console.log('✅ Migración completada')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
