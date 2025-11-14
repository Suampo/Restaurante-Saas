// backend-pasarela/src/routes/mp.public.js
import express from "express";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();
const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// GET /api/psp/mp/public-key?restaurantId=2
router.get("/psp/mp/public-key", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const restaurantId = Number(req.query.restaurantId || 0);
    if (!restaurantId) return res.status(400).json({ error: "restaurantId requerido" });

    const { data, error } = await supa
      .from("psp_credentials")
      .select("public_key, provider, active")
      .eq("restaurant_id", restaurantId)
      .eq("provider", "mercadopago")
      .eq("active", true)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: "Error consultando Supabase" });

    let pk = (data?.public_key || "").trim();
    // Fallback opcional solo para diagnóstico local
    if (!pk) pk = (process.env.MP_PUBLIC_KEY || "").trim();

    if (!pk) return res.status(404).json({ error: "No hay public_key de MP para ese restaurante" });
    return res.json({ publicKey: pk });
  } catch {
    return res.status(500).json({ error: "Error interno" });
  }
});

export default router;
