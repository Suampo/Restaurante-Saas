// backend-facturacion/src/routes/debug.apisperu.js
const express = require('express');
const router = express.Router();
const { getEmisorByRestaurant } = require('../services/facturador');

function decodeJwt(token) {
  try {
    const [h, p] = token.split('.');
    const header = JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    return { header, payload };
  } catch {
    return null;
  }
}

/**
 * GET /debug/apisperu/token?restaurantId=1
 * Muestra el RUC de la DB y el "company" que viene en el JWT.
 */
router.get('/debug/apisperu/token', async (req, res) => {
  try {
    const restaurantId = Number(req.query.restaurantId || 1);
    const emisor = await getEmisorByRestaurant(restaurantId);
    const token = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();
    if (!token) throw new Error('No hay token configurado');

    const decoded = decodeJwt(token);
    if (!decoded) throw new Error('No se pudo decodificar el JWT');

    const companyClaim = decoded?.payload?.company || decoded?.payload?.compania || decoded?.payload?.ruc;
    const match = String(companyClaim) === String(emisor.ruc);

    res.json({
      ok: true,
      ruc_from_db: emisor.ruc,
      token_preview: token.slice(0, 12),
      jwt_claims: decoded.payload,
      company_claim: companyClaim,
      company_matches_db: match
    });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

module.exports = router;
