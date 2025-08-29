// backend-facturacion/src/routes/public.restaurants.js
const express = require('express');
const router = express.Router();
const { getEmisorByRestaurant } = require('../services/facturador');

/**
 * Devuelve settings públicos que tu front necesita para renderizar el checkout.
 * GET /public/restaurants/:id/settings
 */
router.get('/public/restaurants/:id/settings', async (req, res) => {
  try {
    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error('restaurantId inválido');

    const emisor = await getEmisorByRestaurant(restaurantId); // ya lo tienes en tu proyecto

    // Ajusta/añade lo que realmente uses en el front
    const settings = {
      culqiPublicKey: process.env.CULQI_PUBLIC_KEY || emisor.culqi_public_key || '',
      defaultComprobante: '03', // por defecto Boleta
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

module.exports = router;
