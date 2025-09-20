// src/config/supabase.js
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ||      // si la usas en algún entorno
  process.env.SUPABASE_SERVICE_ROLE;       // ← tu .env actual

if (!url) throw new Error("Falta SUPABASE_URL en .env");
if (!key) throw new Error("Falta SUPABASE_SERVICE_ROLE (o SUPABASE_SERVICE_KEY) en .env");

export const supabase = createClient(url, key, { auth: { persistSession: false } });
export const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "menu-images";
