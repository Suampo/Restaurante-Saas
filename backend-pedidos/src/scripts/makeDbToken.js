// scripts/makeDbToken.js
import jwt from "jsonwebtoken";

// Usa EXACTAMENTE el mismo secreto que tienes en .env
const SECRET = process.env.SUPABASE_JWT_SECRET
  || "6UB+5GLKO9GTi9yFSNlIuQgqUkRG90kKL/I2uEqIfbE6bTxUsJcsJrbfv8n9XObpYf4e+2d4tH8qkaGvlENyBA==";

// Ajusta el restaurantId al tuyo
const payload = {
  sub: "dev-admin",
  email: "admin@local",
  role: "admin",
  restaurantId: 1,     // 👈 tu restaurante
};

const token = jwt.sign(payload, SECRET, { algorithm: "HS256", expiresIn: "2h" });
console.log(token);
