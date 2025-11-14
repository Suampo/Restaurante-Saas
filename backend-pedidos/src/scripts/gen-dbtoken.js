// gen-dbtoken.js
import jwt from "jsonwebtoken";
const SECRET = "6UB+5GLKO9GTi9yFSNlIuQgqUkRG90kKL/I2uEqIfbE6bTxUsJcsJrbfv8n9XObpYf4e+2d4tH8qkaGvlENyBA==";

const token = jwt.sign(
  { sub: "dev-admin", email: "admin@local", role: "admin", restaurantId: 1 },
  SECRET,
  { algorithm: "HS256", expiresIn: "1h" }
);
console.log(token);
