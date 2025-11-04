// routes/public.menu.v2.js
import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

/**
 * GET /api/public/menu-v2?restaurantId=1
 * Respuesta:
 * {
 *   combos: [
 *     {
 *       id, nombre, precio, cover_url, activo,
 *       grupos: [
 *         { id, nombre, min, max, orden, categoria_id, items: [ { id, nombre, ... } ] }
 *       ]
 *     }
 *   ]
 * }
 */
router.get("/public/menu-v2", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });

    // 1) Combos + Grupos (sin items aún)
    const { rows: combos } = await pool.query(
      `
      SELECT
        c.id,
        c.nombre,
        c.precio::numeric AS precio,
        c.cover_url,
        c.activo,
        COALESCE(
          json_agg(
            json_build_object(
              'id', cg.id,
              'nombre', COALESCE(cg.nombre_grupo, cat.nombre),
              'min', cg.min_items,
              'max', cg.max_items,
              'orden', cg.orden,
              'categoria_id', cg.categoria_id
            )
            ORDER BY cg.orden
          ) FILTER (WHERE cg.id IS NOT NULL),
          '[]'
        ) AS grupos
      FROM public.combos c
      LEFT JOIN public.combo_grupos cg ON cg.combo_id = c.id
      LEFT JOIN public.categorias  cat ON cat.id = cg.categoria_id
      WHERE c.restaurant_id = $1
        AND c.activo = TRUE
      GROUP BY c.id
      ORDER BY c.id ASC;
      `,
      [restaurantId]
    );

    // 2) Obtener todos los categoria_id usados por los grupos
    const catIds = [];
    for (const c of combos) {
      const gs = Array.isArray(c.grupos) ? c.grupos : [];
      for (const g of gs) if (g?.categoria_id && !catIds.includes(g.categoria_id)) catIds.push(g.categoria_id);
    }

    // 3) Traer items de una sola vez y agrupar por categoria_id
    let itemsByCat = {};
    if (catIds.length) {
      const { rows: items } = await pool.query(
        `
        SELECT id, restaurant_id, nombre, descripcion, precio::numeric AS precio, imagen_url, activo, categoria_id
        FROM public.menu_items
        WHERE restaurant_id = $1
          AND activo = TRUE
          AND deleted_at IS NULL
          AND categoria_id = ANY($2::int[])
        ORDER BY id ASC;
        `,
        [restaurantId, catIds]
      );
      itemsByCat = items.reduce((acc, it) => {
        (acc[it.categoria_id] ||= []).push(it);
        return acc;
      }, {});
    }

    // 4) Pegar items en cada grupo
    const enriched = combos.map((c) => ({
      ...c,
      grupos: (c.grupos || []).map((g) => ({
        ...g,
        items: itemsByCat[g.categoria_id] || [],
      })),
    }));

    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    return res.json({ combos: enriched });
  } catch (e) {
    console.error("[public.menu-v2] ", e);
    res.status(500).json({ error: "Error al obtener menú v2" });
  }
});

export default router;
