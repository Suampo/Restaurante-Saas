// routes/public.menu.js
import { Router } from "express";
import { supabase as admin } from "../config/supabase.js";

const router = Router();

/**
 * GET /api/public/menu?restaurantId=1
 * Respuesta:
 * {
 *   categories: [
 *     { id, nombre, cover_url, items: [ { id, nombre, descripcion, precio, imagen_url, categoria_id } ] }
 *   ],
 *   combos: [ { id, nombre, precio, cover_url } ]
 * }
 */
router.get("/public/menu", async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId);
    if (!restaurantId) {
      return res.status(400).json({ error: "restaurantId requerido" });
    }

    // Carga en paralelo
    const [cats, items, combos] = await Promise.all([
      admin
        .from("categorias")
        .select("id,nombre,cover_url")
        .eq("restaurant_id", restaurantId)
        .order("id", { ascending: true }),

      admin
        .from("menu_items")
        .select("id,nombre,descripcion,precio,imagen_url,categoria_id")
        .eq("restaurant_id", restaurantId)
        .is("deleted_at", null)
        .eq("activo", true)
        .order("id", { ascending: true }),

      admin
        .from("combos")
        .select("id,nombre,precio,cover_url")
        .eq("restaurant_id", restaurantId)
        .eq("activo", true)
        .order("id", { ascending: true }),
    ]);

    // Manejo de errores de Supabase
    if (cats.error)  return res.status(500).json({ error: cats.error.message });
    if (items.error) return res.status(500).json({ error: items.error.message });
    if (combos.error) return res.status(500).json({ error: combos.error.message });

    // Armar categorías con sus items
    const byCat = new Map();
    for (const c of cats.data || []) {
      byCat.set(c.id, { ...c, items: [] });
    }
    for (const it of items.data || []) {
      const bucket =
        byCat.get(it.categoria_id) ||
        (function () {
          // Si llega un item con categoria que no existe, lo mandamos a "Otros"
          const tmp = { id: it.categoria_id ?? -1, nombre: "Otros", cover_url: null, items: [] };
          byCat.set(tmp.id, tmp);
          return tmp;
        })();
      bucket.items.push(it);
    }

    // Opcional: filtra categorías sin items
    const categories = Array.from(byCat.values()).filter(c => c.items.length > 0);

    // Cache corto para el público
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");

    return res.json({
      categories,
      combos: combos.data || [],
    });
  } catch (e) {
    console.error("[public.menu] ", e);
    res.status(500).json({ error: "Error al obtener menú" });
  }
});

export default router;
