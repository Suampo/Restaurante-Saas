// src/routes/webhookRoutes.js
import { Router } from "express";
import { mpWebhook } from "../controllers/mpWebhookController.js";

const router = Router();

// Mercado Pago webhook
router.post("/mp", mpWebhook);

// (si quieres dejar compat con GET/HEAD)
router.get("/mp", (_req, res) => res.status(200).json({ ok: true }));
router.head("/mp", (_req, res) => res.sendStatus(200));

export default router;
