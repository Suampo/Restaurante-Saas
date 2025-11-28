// scripts/migrateImagesToWebp.js
// Ejecuta con: node scripts/migrateImagesToWebp.js

import "../src/loadEnv.js"; // carga .env igual que el servidor
import sharp from "sharp";
import { supabase } from "../src/config/supabase.js";
import { pool } from "../src/config/db.js";

const MAX_SIZE = 1600;

/**
 * Extrae el path interno del objeto a partir de la public URL de Supabase.
 * Ejemplo:
 *  https://...supabase.co/storage/v1/object/public/menu-items/restaurants/1/...
 *  => restaurants/1/...
 */
function extractPathFromPublicUrl(url, bucket) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) {
    throw new Error(`URL no coincide con bucket ${bucket}: ${url}`);
  }
  return url.substring(idx + marker.length);
}

async function processRow({ table, column, bucket, row, idColumn = "id" }) {
  const url = row[column];
  if (!url) return;

  // si ya es .webp, saltar
  if (/\.webp(\?|$)/i.test(url)) {
    console.log(`✅ ${table}.${column} (id=${row[idColumn]}): ya es webp, skip`);
    return;
  }

  let objectPath;
  try {
    objectPath = extractPathFromPublicUrl(url, bucket);
  } catch (err) {
    console.warn(
      `⚠️ No se pudo extraer path para ${table} id=${row[idColumn]}:`,
      err.message
    );
    return;
  }

  console.log(`➡️  Procesando ${table} id=${row[idColumn]}: ${objectPath}`);

  // descargar del bucket original
  const { data: file, error: dlErr } = await supabase
    .storage
    .from(bucket)
    .download(objectPath);

  if (dlErr) {
    console.error(`❌ Error descargando ${objectPath}:`, dlErr.message);
    return;
  }

  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  // convertir a webp + resize
  const webpBuffer = await sharp(buf)
    .rotate()
    .resize({
      width: MAX_SIZE,
      height: MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  const newPath = objectPath.replace(/\.(jpe?g|png|gif)$/i, ".webp");

  // subir versión optimizada
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(newPath, webpBuffer, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: true,
    });

  if (upErr) {
    console.error(`❌ Error subiendo ${newPath}:`, upErr.message);
    return;
  }

  // generar nueva public URL
  const { data: pub } = supabase.storage
    .from(bucket)
    .getPublicUrl(newPath);

  const newUrl = pub.publicUrl;

  // actualizar BD
  const query = `
    UPDATE ${table}
    SET ${column} = $1
    WHERE ${idColumn} = $2
  `;
  await pool.query(query, [newUrl, row[idColumn]]);

  console.log(
    `✅ Actualizado ${table}.${column} id=${row[idColumn]} -> ${newUrl}`
  );
}

async function migrateTable({ table, column, bucket, idColumn = "id" }) {
  console.log(`\n=== Migrando tabla ${table} (${column}) en bucket ${bucket} ===`);

  // ⚠️ Para ir con cuidado, al inicio puedes poner LIMIT 20.
  const { rows } = await pool.query(
    `
    SELECT ${idColumn}, ${column}
    FROM ${table}
    WHERE ${column} IS NOT NULL
      AND ${column} NOT LIKE '%.webp'
    `
  );

  console.log(`Encontradas ${rows.length} filas a procesar.`);

  for (const row of rows) {
    try {
      await processRow({ table, column, bucket, row, idColumn });
    } catch (err) {
      console.error(
        `❌ Error en fila ${table} id=${row[idColumn]}:`,
        err.message
      );
    }
  }

  console.log(`=== Fin tabla ${table} ===\n`);
}

async function main() {
  try {
    // 1) menu_items.imagen_url
    // Usa SUPABASE_BUCKET_MENU si existe, si no SUPABASE_BUCKET, si no "menu-items"
    const bucketMenu =
      process.env.SUPABASE_BUCKET_MENU ||
      process.env.SUPABASE_BUCKET ||
      "menu-items";
    await migrateTable({
      table: "menu_items",
      column: "imagen_url",
      bucket: bucketMenu,
    });

    // 2) categorias.cover_url  (bucket SUPABASE_BUCKET_CATEGORIES || 'categories')
    const bucketCat = process.env.SUPABASE_BUCKET_CATEGORIES || "categories";
    await migrateTable({
      table: "categorias",
      column: "cover_url",
      bucket: bucketCat,
    });

    // 3) combos.cover_url  (bucket SUPABASE_BUCKET_COMBOS || 'combos')
    const bucketCombos = process.env.SUPABASE_BUCKET_COMBOS || "combos";
    await migrateTable({
      table: "combos",
      column: "cover_url",
      bucket: bucketCombos,
    });

    console.log("🎉 Migración completada");
  } catch (err) {
    console.error("❌ Error general en migración:", err);
  } finally {
    await pool.end();
  }
}

main();
