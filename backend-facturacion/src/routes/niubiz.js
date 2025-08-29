// backend-facturacion/src/routes/niubiz.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');
// Normaliza igual que Culqi y reusa el flujo

router.post('/webhooks/niubiz', express.json({ type: '*/*' }), async (req, res) => {
  // TODO: mapea payload de Niubiz -> {orderId, restaurantId, comprobanteTipo}
  // luego repetir exactamente la lógica de culqi.js
  res.json({ ok: true });
});

module.exports = router;
