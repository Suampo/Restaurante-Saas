import { Router } from "express";
import { supabase as admin } from "../config/supabase.js";
import { signDbToken } from "../auth/signDbToken.js";

const router = Router();

router.post("/session/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Faltan credenciales" });

    const { data: user, error } = await admin
      .from("usuarios")
      .select("id, email, password, restaurant_id, rol")
      .eq("email", email)
      .single();

    if (error || !user) return res.status(401).json({ error: "Usuario no encontrado" });
    // TODO: valida password con bcrypt.compare(password, user.password)
    if (user.rol !== "admin") return res.status(403).json({ error: "Solo admin" });

    const dbToken = await signDbToken({ email: user.email, restaurantId: user.restaurant_id, ttlSec: 3600 });
    return res.json({ dbToken, restaurantId: user.restaurant_id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

export default router;
