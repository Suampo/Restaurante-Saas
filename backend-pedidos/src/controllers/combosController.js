import { pool } from "../config/db.js";
import { supabase } from "../config/supabase.js";

/* ============ GET /api/combos (activos) ============ */
export const getCombos = async (req, res) => {
  try {
    const restaurantId = Number(req.user.restaurantId);

    // Trae combos y sus grupos ordenados como JSON
    const { rows } = await pool.query(
      `
      SELECT
        c.id, c.nombre, c.precio, c.cover_url, c.activo,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', cg.id,
                'categoria_id', cg.categoria_id,
                'nombre', cg.nombre_grupo,
                'min', cg.min_items,
                'max', cg.max_items,
                'orden', cg.orden
              )
              ORDER BY cg.orden
            )
            FROM combo_grupos cg
            WHERE cg.combo_id = c.id
          ),
          '[]'::json
        ) AS grupos
      FROM combos c
      WHERE c.restaurant_id = $1 AND c.activo = TRUE
      ORDER BY c.id DESC
      `,
      [restaurantId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ getCombos:", err.stack || err.message);
    res.status(500).json({ error: "Error obteniendo combos" });
  }
};

/* ============ POST /api/combos (v1 simple) ============ */
export const createCombo = async (req, res) => {
  try {
    const restaurantId = Number(req.user.restaurantId);
    const { nombre, precio, activo = true, cover_url = null } = req.body;

    if (!nombre || precio == null) {
      return res.status(400).json({ error: "Faltan campos válidos" });
    }

    const { rows } = await pool.query(
      `INSERT INTO combos (restaurant_id, nombre, precio, cover_url, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, precio, cover_url, activo`,
      [restaurantId, nombre.trim(), Number(precio), cover_url, !!activo]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ createCombo:", err.stack || err.message);
    res.status(500).json({ error: "Error creando combo" });
  }
};

/* ============ PUT /api/combos/:id ============ */
export const updateCombo = async (req, res) => {
  try {
    const restaurantId = Number(req.user.restaurantId);
    const { id } = req.params;
    const { nombre = null, precio = null, activo = null, cover_url = null } = req.body;

    const { rows } = await pool.query(
      `UPDATE combos
           SET nombre    = COALESCE($3, nombre),
               precio    = COALESCE($4, precio),
               cover_url = COALESCE($5, cover_url),
               activo    = COALESCE($6, activo)
         WHERE id = $1 AND restaurant_id = $2
         RETURNING id, nombre, precio, cover_url, activo`,
      [
        Number(id),
        restaurantId,
        nombre && nombre.trim ? nombre.trim() : nombre,
        precio !== null ? Number(precio) : null,
        cover_url,
        typeof activo === "boolean" ? activo : null,
      ]
    );

    if (!rows.length) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ updateCombo:", err.stack || err.message);
    res.status(500).json({ error: "Error actualizando combo" });
  }
};

/* ============ DELETE /api/combos/:id (soft) ============ */
export const deleteCombo = async (req, res) => {
  try {
    const restaurantId = Number(req.user.restaurantId);
    const { id } = req.params;

    const { rowCount } = await pool.query(
      `UPDATE combos
          SET activo = FALSE
        WHERE id = $1 AND restaurant_id = $2`,
      [Number(id), restaurantId]
    );

    if (!rowCount) return res.status(404).json({ error: "No encontrado" });
    res.json({ ok: true });
  } catch (err) {
    console.error("❌ deleteCombo:", err.stack || err.message);
    res.status(500).json({ error: "Error desactivando combo" });
  }
};

/* ============ PUT /api/combos/:id/cover ============ */
export const updateComboCover = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    const id = Number(req.params.id);
    if (!restaurantId || !id) return res.status(400).json({ error: "Datos inválidos" });
    if (!req.file) return res.status(400).json({ error: "Falta imagen" });

    const ext = (req.file.mimetype || "image/jpeg").split("/")[1] || "jpg";
    const path = `rest-${restaurantId}/combos/${id}-${Date.now()}.${ext}`;

    const { data, error } = await supabase
      .storage.from("menu-images")
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (error) throw error;

    const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(data.path);
    const cover_url = pub.publicUrl;

    await pool.query(
      `UPDATE combos SET cover_url=$1 WHERE id=$2 AND restaurant_id=$3`,
      [cover_url, id, restaurantId]
    );

    res.json({ ok: true, cover_url });
  } catch (e) {
    console.error("❌ updateComboCover:", e);
    res.status(500).json({ error: "No se pudo subir la portada" });
  }
};

/* ============ V2: combos con N grupos ============ */
export const createComboV2 = async (req, res) => {
  const client = await pool.connect();
  try {
    const restaurantId = Number(req.user.restaurantId);
    const { nombre, precio, cover_url = null, activo = true, grupos = [] } = req.body;

    if (!restaurantId || !nombre || precio == null) {
      return res.status(400).json({ error: "restaurantId, nombre y precio son requeridos" });
    }

    await client.query("BEGIN");

    const { rows: crows } = await client.query(
      `INSERT INTO combos (restaurant_id, nombre, precio, cover_url, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, precio, cover_url, activo`,
      [restaurantId, nombre.trim(), Number(precio), cover_url, !!activo]
    );
    const combo = crows[0];

    if (Array.isArray(grupos) && grupos.length) {
      const values = [];
      const placeholders = [];
      grupos.forEach((g, i) => {
        const idx = i * 6;
        placeholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`);
        values.push(
          combo.id,
          Number(g.categoriaId),
          g.nombre || null,
          Math.max(0, Number(g.min ?? 1)),
          Math.max(1, Number(g.max ?? 1)),
          Number(g.orden ?? i + 1)
        );
      });

      await client.query(
        `INSERT INTO public.combo_grupos (combo_id, categoria_id, nombre_grupo, min_items, max_items, orden)
         VALUES ${placeholders.join(",")}`,
        values
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ ok: true, id: combo.id });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ createComboV2:", e);
    res.status(500).json({ error: "Error creando combo (v2)" });
  } finally {
    client.release();
  }
};

export const updateComboV2 = async (req, res) => {
  const client = await pool.connect();
  try {
    const restaurantId = Number(req.user.restaurantId);
    const comboId = Number(req.params.id);
    const { nombre = null, precio = null, cover_url = null, activo = null, grupos = null } = req.body;

    await client.query("BEGIN");

    if (nombre != null || precio != null || cover_url != null || activo != null) {
      await client.query(
        `UPDATE combos
           SET nombre = COALESCE($3, nombre),
               precio = COALESCE($4, precio),
               cover_url = COALESCE($5, cover_url),
               activo = COALESCE($6, activo)
         WHERE id = $1 AND restaurant_id = $2`,
        [comboId, restaurantId,
          nombre && nombre.trim ? nombre.trim() : nombre,
          precio !== null ? Number(precio) : null,
          cover_url,
          typeof activo === "boolean" ? activo : null]
      );
    }

    if (Array.isArray(grupos)) {
      await client.query(`DELETE FROM public.combo_grupos WHERE combo_id = $1`, [comboId]);
      if (grupos.length) {
        const values = [];
        const placeholders = [];
        grupos.forEach((g, i) => {
          const idx = i * 6;
          placeholders.push(`($${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6})`);
          values.push(
            comboId,
            Number(g.categoriaId),
            g.nombre || null,
            Math.max(0, Number(g.min ?? 1)),
            Math.max(1, Number(g.max ?? 1)),
            Number(g.orden ?? i + 1)
          );
        });
        await client.query(
          `INSERT INTO public.combo_grupos (combo_id, categoria_id, nombre_grupo, min_items, max_items, orden)
           VALUES ${placeholders.join(",")}`,
          values
        );
      }
    }

    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ updateComboV2:", e);
    res.status(500).json({ error: "Error actualizando combo (v2)" });
  } finally {
    client.release();
  }
};
