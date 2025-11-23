import { pool } from "../config/db.js";

// helpers
const num = (v) => (v === undefined || v === null || v === "" ? null : Number(v));

function buildUpdate(obj) {
  // genera SET dinámico solo con campos presentes (no undefined)
  const fields = [];
  const values = [];
  let i = 1;
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    fields.push(`${k} = $${i++}`);
    values.push(v);
  }
  return { fields, values };
}

// =========================
// GET /api/menu-items
// =========================
export const getMenuItems = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const categoriaId = req.query.categoriaId ? Number(req.query.categoriaId) : null;
    const q = (req.query.q || "").toString().trim().toLowerCase();

    let activos = req.query.activos; // "true" | "false" | "all" | undefined
    if (!activos) activos = "true";  // por defecto: solo activos

    const where = ["mi.restaurant_id = $1"];
    const params = [restaurantId];
    let idx = 2;

    if (categoriaId) {
      where.push(`mi.categoria_id = $${idx}`);
      params.push(categoriaId);
      idx++;
    }
    if (q) {
      where.push(`(LOWER(mi.nombre) LIKE $${idx} OR LOWER(mi.descripcion) LIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }

    // filtro por estado
    if (activos === "true")  where.push("mi.activo = TRUE");
    if (activos === "false") where.push("mi.activo = FALSE");
    // si activos === "all", no añadimos nada -> lista todo

    const sql = `
      SELECT mi.id, mi.nombre, mi.descripcion, mi.precio, mi.imagen_url, mi.activo,
             mi.categoria_id, c.nombre AS categoria_nombre
        FROM menu_items mi
        LEFT JOIN categorias c ON c.id = mi.categoria_id
       WHERE ${where.join(" AND ")}
       ORDER BY mi.id DESC
    `;

    const { rows } = await pool.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error("❌ getMenuItems:", err.stack || err.message);
    res.status(500).json({ error: "Error obteniendo items" });
  }
};

// =========================
// POST /api/menu-items
// =========================
export const createMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const nombre = (req.body?.nombre || "").toString().trim();
    const descripcion = (req.body?.descripcion ?? null);
    const precio = num(req.body?.precio);
const categoriaId = num(
     req.body?.categoriaId !== undefined
       ? req.body.categoriaId
       : req.body?.categoria_id !== undefined
       ? req.body.categoria_id
       : null
   );
    if (!nombre || precio === null || Number.isNaN(precio)) {
      return res.status(400).json({ error: "Faltan nombre o precio válido" });
    }

    const { rows } = await pool.query(
      `INSERT INTO menu_items (restaurant_id, nombre, descripcion, precio, activo, categoria_id)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       RETURNING id, nombre, descripcion, precio, imagen_url, activo, categoria_id`,
      [restaurantId, nombre, descripcion, precio, categoriaId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("❌ createMenuItem:", err.stack || err.message);
    res.status(500).json({ error: "Error creando item" });
  }
};

// =========================
// PUT /api/menu-items/:id
// =========================
export const updateMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const id = Number(req.params.id);

    const setObj = {
      nombre: req.body?.nombre !== undefined ? String(req.body.nombre).trim() : undefined,
      descripcion: req.body?.descripcion !== undefined ? (req.body.descripcion ?? null) : undefined,
      precio: req.body?.precio !== undefined ? num(req.body.precio) : undefined,
      activo: typeof req.body?.activo === "boolean" ? req.body.activo : undefined,
      categoria_id: req.body?.categoriaId !== undefined ? num(req.body.categoriaId) : undefined,
    };

    const { fields, values } = buildUpdate(setObj);
    if (fields.length === 0) {
      return res.status(400).json({ error: "Nada para actualizar" });
    }

    const sql = `
      UPDATE menu_items
         SET ${fields.join(", ")}
       WHERE id = $${values.length + 1}
         AND restaurant_id = $${values.length + 2}
       RETURNING id, nombre, descripcion, precio, imagen_url, activo, categoria_id
    `;
    const params = [...values, id, restaurantId];

    const r = await pool.query(sql, params);
    if (r.rowCount === 0) return res.status(404).json({ error: "No encontrado" });

    res.json(r.rows[0]);
  } catch (err) {
    console.error("❌ updateMenuItem:", err.stack || err.message);
    res.status(500).json({ error: "Error actualizando item" });
  }
};

// =========================
// DELETE /api/menu-items/:id
//  — soft delete: activo = FALSE
// =========================
export const deleteMenuItem = async (req, res) => {
  try {
    const restaurantId = req.user.restaurantId;
    const id = Number(req.params.id);

    const r = await pool.query(
      `UPDATE menu_items
          SET activo = FALSE
        WHERE id = $1 AND restaurant_id = $2
        RETURNING id`,
      [id, restaurantId]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({ error: "Item no encontrado" });
    }
    res.json({ ok: true, softDeleted: true });
  } catch (err) {
    if (err.code === "23503") {
      return res.status(409).json({
        error: "Este plato ya tiene pedidos asociados. No puede eliminarse, desactívalo.",
      });
    }
    console.error("❌ deleteMenuItem:", err.stack || err.message);
    res.status(500).json({ error: "Error desactivando item" });
  }
};
