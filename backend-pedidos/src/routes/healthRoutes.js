// src/routes/healthRoutes.js
//PRUEBAS PARA K6 CON LA CARPETA
import { Router } from "express";

const router = Router();

router.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "backend-pedidos",
    time: new Date().toISOString(),
  });
});

export default router;
