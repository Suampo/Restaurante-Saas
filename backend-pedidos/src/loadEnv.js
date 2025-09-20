// src/loadEnv.js
import { config } from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga el .env desde la raíz del proyecto (un nivel arriba de src)
config({ path: path.join(__dirname, "../.env") });
