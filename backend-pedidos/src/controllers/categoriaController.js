import { pool } from "../config/db.js";
import multer from "multer";
import { supabase } from "../config/supabase.js";

/* ===================== LISTAR ===================== */
export const listCategorias = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId ?? req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });

    const { rows } = await pool.query(
      `SELECT id, nombre, cover_url
         FROM categorias
        WHERE restaurant_id = $1
        ORDER BY nombre`,
      [restaurantId]
    );
    res.json(rows);
  } catch (e) {
    console.error("❌ listCategorias:", e);
    res.status(500).json({ error: "Error listando categorías" });
  }
};

/* ===================== CREAR ===================== */
export const createCategoria = async (req, res) => {
  try {
    const restaurantId = Number(req.body.restaurantId) || Number(req.user?.restaurantId);
    const nombre = (req.body.nombre || "").trim();
    if (!restaurantId || !nombre) return res.status(400).json({ error: "Datos incompletos" });

    const { rows } = await pool.query(
      `INSERT INTO categorias (restaurant_id, nombre)
       VALUES ($1, $2)
       RETURNING id, nombre, cover_url`,
      [restaurantId, nombre]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("❌ createCategoria:", e);
    res.status(500).json({ error: "Error creando categoría" });
  }
};

/* ===================== ACTUALIZAR ===================== */
export const updateCategoria = async (req, res) => {
  try {
    const restaurantId = Number(req.user?.restaurantId);
    const { id } = req.params;
    const nombre = req.body?.nombre?.trim() ?? null;

    const { rows } = await pool.query(
      `UPDATE categorias
          SET nombre = COALESCE($3, nombre)
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id, nombre, cover_url`,
      [Number(id), restaurantId, nombre]
    );

    if (!rows.length) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (e) {
    console.error("❌ updateCategoria:", e);
    res.status(500).json({ error: "Error actualizando categoría" });
  }
};

/* ===================== BORRAR (con ?force=1) ===================== */
// BORRAR  — con ?force=1 seguro para historiales de pedidos
export const deleteCategoria = async (req, res) => {
  const client = await pool.connect();
  try {
    const restaurantId = Number(req.user?.restaurantId ?? req.query.restaurantId);
    const id = Number(req.params.id);
    const force =
      String(req.query.force ?? req.body?.force ?? "0") === "1" ||
      String(req.query.force ?? "").toLowerCase() === "true";

    if (!restaurantId || !id) return res.status(400).json({ error: "Datos inválidos" });

    // Existe y pertenece
    const exists = await client.query(
      `SELECT 1 FROM categorias WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );
    if (!exists.rowCount) return res.status(404).json({ error: "No encontrada" });

    // Uso en combos y platos (para el 409)
    const { rows: rCg } = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM combo_grupos cg
         JOIN combos co ON co.id = cg.combo_id
        WHERE cg.categoria_id = $1 AND co.restaurant_id = $2`,
      [id, restaurantId]
    );
    const inCombos = rCg[0]?.n ?? 0;

    const { rows: rMi } = await client.query(
      `SELECT COUNT(*)::int AS n
         FROM menu_items
        WHERE categoria_id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    );
    const inMenuItems = rMi[0]?.n ?? 0;

    if (!force && (inCombos > 0 || inMenuItems > 0)) {
      return res.status(409).json({
        error: "CATEGORY_IN_USE",
        message: "La categoría está en uso por el menú/combos.",
        detail: { categoryId: id, inCombos, inMenuItems },
      });
    }

    await client.query("BEGIN");

    // 1) Platos -> sin categoría
    const updItems = await client.query(
      `UPDATE menu_items
          SET categoria_id = NULL
        WHERE restaurant_id = $2 AND categoria_id = $1`,
      [id, restaurantId]
    );

    // 2) Grupos de combos que apuntan a esta categoría (del mismo restaurant)
    //    - Si el grupo tiene pedidos históricos -> NO borrar: solo desvincular (categoria_id=NULL)
    //    - Si NO tiene pedidos -> borrar
    const { rows: grp } = await client.query(
      `
      SELECT cg.id,
             EXISTS (
               SELECT 1
                 FROM pedido_detalle_combo_items i
                WHERE i.combo_grupo_id = cg.id
                LIMIT 1
             ) AS has_orders
        FROM combo_grupos cg
        JOIN combos co ON co.id = cg.combo_id
       WHERE cg.categoria_id = $1
         AND co.restaurant_id = $2
      `,
      [id, restaurantId]
    );

    const idsHasOrders = grp.filter(g => g.has_orders).map(g => g.id);
    const idsNoOrders  = grp.filter(g => !g.has_orders).map(g => g.id);

    if (idsHasOrders.length) {
      // desvincular (requiere que combo_grupos.categoria_id acepte NULL)
      await client.query(
        `UPDATE combo_grupos
            SET categoria_id = NULL
          WHERE id = ANY($1::int[])`,
        [idsHasOrders]
      );
    }

    if (idsNoOrders.length) {
      await client.query(
        `DELETE FROM combo_grupos
          WHERE id = ANY($1::int[])`,
        [idsNoOrders]
      );
    }

    // 3) Eliminar la categoría
    await client.query(
      `DELETE FROM categorias WHERE id=$1 AND restaurant_id=$2`,
      [id, restaurantId]
    );

    await client.query("COMMIT");
    res.json({
      ok: true,
      deletedCategoryId: id,
      clearedMenuItems: updItems.rowCount,
      detachedComboGroups: idsHasOrders.length,
      removedComboGroups: idsNoOrders.length,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("❌ deleteCategoria(force):", e.stack || e.message);
    res.status(500).json({ error: "Error eliminando categoría" });
  } finally {
    client.release();
  }
};

/* ===================== UPLOAD COVER ===================== */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

export async function updateCategoriaCover(req, res) {
  try {
    const restaurantId = req.user?.restaurantId || req.tenantId;
    const id = Number(req.params.id);
    if (!restaurantId || !id) return res.status(400).json({ error: "Datos inválidos" });
    if (!req.file) return res.status(400).json({ error: "Falta imagen" });

    const ext = (req.file.mimetype || "image/jpeg").split("/")[1] || "jpg";
    const path = `rest-${restaurantId}/categories/${id}-${Date.now()}.${ext}`;

    const { data, error } = await supabase
      .storage.from("menu-images")
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true });

    if (error) throw error;

    const { data: pub } = supabase.storage.from("menu-images").getPublicUrl(data.path);
    const cover_url = pub.publicUrl;

    await pool.query(
      `UPDATE categorias SET cover_url=$1
        WHERE id=$2 AND restaurant_id=$3`,
      [cover_url, id, restaurantId]
    );

    res.json({ ok: true, cover_url });
  } catch (e) {
    console.error("updateCategoriaCover:", e);
    res.status(500).json({ error: "No se pudo subir la portada", detail: e.message });
  }
}
