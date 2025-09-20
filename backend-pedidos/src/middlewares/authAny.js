import jwt from "jsonwebtoken";

const tryVerify = (token, secret) => {
  try {
    if (!secret) return null;
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
};

export const authAny = (req, res, next) => {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7)
    : header;

  if (!token) return res.status(401).json({ error: "Falta token" });

  // Acepta tokens de ADMIN o CLIENTE
  const p =
    tryVerify(token, process.env.SUPABASE_JWT_SECRET) ||
    tryVerify(token, process.env.JWT_CLIENT_SECRET);

  if (!p) return res.status(401).json({ error: "Token inválido" });
  if (!p.restaurantId)
    return res.status(403).json({ error: "Token sin restaurantId" });

  req.user = {
    id: p.userId,
    restaurantId: p.restaurantId,
    rol: p.rol || "client",
  };
  next();
};
