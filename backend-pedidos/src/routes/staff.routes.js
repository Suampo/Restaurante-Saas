import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { requireDbToken } from "../middlewares/requireDbToken.js";

const router = Router();
const onlyAdmin = (req, res, next) => {
  const role = String(req.user?.role || req.user?.rol || "").toLowerCase();
  if (role === "owner" || role === "admin") return next();
  return res.status(403).json({ error: "Solo admin/owner" });
};

// LISTAR
router.get("/", requireDbToken, onlyAdmin, async (req, res) => {
  const rid = Number(req.user.restaurant_id || req.user.restaurantId);
  const { rows } = await pool.query(
    "SELECT id, nombre, email, rol, created_at FROM usuarios WHERE restaurant_id=$1 ORDER BY created_at DESC",
    [rid]
  );
  res.json(rows);
});

// CREAR
router.post("/", requireDbToken, onlyAdmin, async (req, res) => {
  const rid = Number(req.user.restaurant_id || req.user.restaurantId);
  const { nombre, email, rol = "staff", password } = req.body || {};
  if (!nombre || !email) return res.status(400).json({ error: "Falta nombre/email" });

  const pwd = password && String(password).length >= 6
    ? String(password)
    : Math.random().toString(36).slice(-8);

  const hash = await bcrypt.hash(pwd, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuarios (restaurant_id, nombre, email, rol, password_hash)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, nombre, email, rol`,
    [rid, nombre, email.toLowerCase(), rol, hash]
  );

  res.json({ ...rows[0], tempPassword: pwd });
});

// ACTUALIZAR (nombre/rol y opcional reset de password)
router.patch("/:id", requireDbToken, onlyAdmin, async (req, res) => {
  const rid = Number(req.user.restaurant_id || req.user.restaurantId);
  const id = Number(req.params.id);
  const { nombre, rol, resetPassword } = req.body || {};

  let hash = null, newPwd = null;
  if (resetPassword) {
    newPwd = Math.random().toString(36).slice(-10);
    hash = await bcrypt.hash(newPwd, 10);
  }

  const { rows } = await pool.query(
    `UPDATE usuarios SET
        nombre = COALESCE($1, nombre),
        rol    = COALESCE($2, rol),
        password_hash = COALESCE($3, password_hash)
     WHERE id=$4 AND restaurant_id=$5
     RETURNING id, nombre, email, rol`,
    [nombre || null, rol || null, hash, id, rid]
  );

  if (!rows.length) return res.status(404).json({ error: "No encontrado" });
  res.json({ ...rows[0], ...(newPwd ? { tempPassword: newPwd } : {}) });
});

// ELIMINAR
router.delete("/:id", requireDbToken, onlyAdmin, async (req, res) => {
  const rid = Number(req.user.restaurant_id || req.user.restaurantId);
  const id = Number(req.params.id);
  const { rowCount } = await pool.query(
    "DELETE FROM usuarios WHERE id=$1 AND restaurant_id=$2",
    [id, rid]
  );
  if (!rowCount) return res.status(404).json({ error: "No encontrado" });
  res.json({ ok: true });
});

export default router;
