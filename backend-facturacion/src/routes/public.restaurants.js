// backend-facturacion/src/routes/public.restaurants.js
const express = require('express');
const router = express.Router();
const { getEmisorByRestaurant } = require('../services/facturador');

/**
 * EXISTENTE
 * GET /public/restaurants/:id/settings
 */
router.get('/public/restaurants/:id/settings', async (req, res) => {
  try {
    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error('restaurantId inválido');

    const emisor = await getEmisorByRestaurant(restaurantId);

    const settings = {
      culqiPublicKey: process.env.CULQI_PUBLIC_KEY || emisor.culqi_public_key || '',
      defaultComprobante: '03',
      series: {
        '01': emisor.factura_serie || 'F001',
        '03': emisor.boleta_serie || 'B001',
      },
      company: {
        ruc: emisor.ruc,
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial || emisor.razon_social,
        address: {
          ubigeo: emisor.ubigeo || '',
          departamento: emisor.departamento || '',
          provincia: emisor.provincia || '',
          distrito: emisor.distrito || '',
          direccion: emisor.direccion || '',
          urbanizacion: emisor.urbanizacion || '',
        },
      },
    };

    res.json({ ok: true, settings });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

/**
 * NUEVO (lo que espera el frontend)
 * GET /api/pay/public/:id/config  -> { culqiPublicKey, name }
 */
router.get('/api/pay/public/:id/config', async (req, res) => {
  try {
    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error('restaurantId inválido');

    const emisor = await getEmisorByRestaurant(restaurantId).catch(() => null);

    const culqiPublicKey =
      process.env.CULQI_PUBLIC_KEY ||
      process.env.VITE_CULQI_PUBLIC_KEY ||
      (emisor && emisor.culqi_public_key) ||
      '';

    if (!culqiPublicKey) {
      return res.status(404).json({ message: 'Culqi public key no configurada' });
    }

    const name =
      (emisor && (emisor.nombre_comercial || emisor.razon_social)) ||
      process.env.RESTAURANT_NAME ||
      'Restaurante';

    res.json({ culqiPublicKey, name });
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
});

module.exports = router;
