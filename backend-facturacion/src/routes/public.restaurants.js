// backend-facturacion/src/routes/public.restaurants.js
const express = require('express');
const router = express.Router();
const { getEmisorByRestaurant } = require('../services/facturador');
const { supabase } = require('../services/supabase');

/**
 * EXISTENTE
 * GET /public/restaurants/:id/settings
 * Devuelve settings para facturación + billingMode (sunat|none)
 */
router.get('/public/restaurants/:id/settings', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error('restaurantId inválido');

    const emisor = await getEmisorByRestaurant(restaurantId);

    // Leer billing_mode desde la tabla restaurantes
    const { data: rest, error } = await supabase
      .from('restaurantes')
      .select('billing_mode')
      .eq('id', restaurantId)
      .maybeSingle();
    if (error) throw error;

    const billingMode = String(rest?.billing_mode || 'none').toLowerCase();

    const settings = {
      culqiPublicKey:
        process.env.CULQI_PUBLIC_KEY || emisor.culqi_public_key || '',
      billingMode, // <-- ahora disponible para el frontend
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
 * GET /api/pay/public/:id/config  -> { culqiPublicKey, name, billingMode }
 */
router.get('/api/pay/public/:id/config', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');

    const restaurantId = Number(req.params.id);
    if (!restaurantId) throw new Error('restaurantId inválido');

    const emisor = await getEmisorByRestaurant(restaurantId).catch(() => null);

    const culqiPublicKey =
      process.env.CULQI_PUBLIC_KEY ||
      process.env.VITE_CULQI_PUBLIC_KEY ||
      (emisor && emisor.culqi_public_key) ||
      '';

    if (!culqiPublicKey) {
      return res
        .status(404)
        .json({ message: 'Culqi public key no configurada' });
    }

    // Leer billing_mode desde la tabla restaurantes
    const { data: rest, error } = await supabase
      .from('restaurantes')
      .select('billing_mode')
      .eq('id', restaurantId)
      .maybeSingle();
    if (error) throw error;

    const billingMode = String(rest?.billing_mode || 'none').toLowerCase();

    const name =
      (emisor && (emisor.nombre_comercial || emisor.razon_social)) ||
      process.env.RESTAURANT_NAME ||
      'Restaurante';

    // Exponer billingMode en camelCase para el frontend
    res.json({ culqiPublicKey, name, billingMode });
  } catch (e) {
    res.status(404).json({ message: e.message });
  }
});

module.exports = router;
