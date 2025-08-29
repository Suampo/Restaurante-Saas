// backend-facturacion/src/routes/pedidos.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');

/**
 * Normaliza/valida el billing_client según el tipo de comprobante.
 * - "01" (Factura) => tipoDoc "6" (RUC) y rznSocial requerido.
 * - "03" (Boleta)  => tipoDoc por defecto "1" (DNI) si no viene.
 */
function normalizeBillingClient(billing, comprobanteTipo) {
  const c = { ...(billing || {}) };

  // Limpieza básica
  const trim = (v) => (typeof v === 'string' ? v.trim() : v);
  ['numDoc', 'rznSocial', 'nombres', 'apellidos', 'email', 'telefono', 'direccion', 'ubigeo']
    .forEach(k => { if (c[k] != null) c[k] = trim(c[k]); });

  // Asegurar tipoDoc como string
  if (c.tipoDoc != null) c.tipoDoc = String(c.tipoDoc);

  if (comprobanteTipo === '01') {
    // FACTURA (RUC)
    c.tipoDoc = '6';
    if (!c.numDoc || !/^\d{11}$/.test(c.numDoc)) {
      throw new Error('Para FACTURA se requiere RUC de 11 dígitos en billingClient.numDoc');
    }
    if (!c.rznSocial) {
      throw new Error('Para FACTURA se requiere billingClient.rznSocial');
    }
  } else {
    // BOLETA
    if (!c.tipoDoc) c.tipoDoc = '1'; // DNI por defecto
    if (c.tipoDoc === '1' && c.numDoc && !/^\d{8}$/.test(c.numDoc)) {
      throw new Error('DNI inválido en billingClient.numDoc (8 dígitos)');
    }
  }

  // Email opcional
  if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) {
    throw new Error('Email inválido en billingClient.email');
  }
  return c;
}

/**
 * Calcula total desde items si no vino "total".
 * items: [{ cantidad, precio_unitario }]
 */
function computeTotalFromItems(items = []) {
  return items.reduce((s, it) => s + Number(it.precio_unitario || 0) * Number(it.cantidad || 1), 0);
}

/**
 * Intenta deducir restaurantId si no vino en el body:
 * - Si viene mesaId, consulta mesas -> restaurant_id
 * - (Opcional) podrías deducirlo de items si cada item incluye restaurant_id
 */
async function ensureRestaurantId({ restaurantId, mesaId }) {
  if (restaurantId) return Number(restaurantId);
  if (!mesaId) throw new Error('restaurantId o mesaId requerido');

  const { data: mesa, error } = await supabase
    .from('mesas')
    .select('id, restaurant_id')
    .eq('id', mesaId)
    .maybeSingle();
  if (error) throw error;
  if (!mesa) throw new Error('Mesa no encontrada');
  return Number(mesa.restaurant_id);
}

/**
 * Inserta detalles si mandas "items".
 * items: [{ menu_item_id?, combo_id?, cantidad, precio_unitario }]
 */
async function insertDetallesIfAny(pedidoId, restaurantId, items = []) {
  if (!items?.length) return;

  // IDs únicos
  const menuIds  = [...new Set(items.filter(it => it.menu_item_id).map(it => Number(it.menu_item_id)))];
  const comboIds = [...new Set(items.filter(it => it.combo_id).map(it => Number(it.combo_id)))];

  // Valida que existan en el restaurante
  let menuValid = new Set(), comboValid = new Set();

  if (menuIds.length) {
    const { data: menuRows, error: e1 } = await supabase
      .from('menu_items')
      .select('id')
      .in('id', menuIds)
      .eq('restaurant_id', restaurantId);
    if (e1) throw e1;
    menuValid = new Set((menuRows || []).map(r => r.id));
  }

  if (comboIds.length) {
    const { data: comboRows, error: e2 } = await supabase
      .from('combos')
      .select('id')
      .in('id', comboIds)
      .eq('restaurant_id', restaurantId);
    if (e2) throw e2;
    comboValid = new Set((comboRows || []).map(r => r.id));
  }

  const invalidMenu  = menuIds.filter(id => !menuValid.has(id));
  const invalidCombo = comboIds.filter(id => !comboValid.has(id));
  if (invalidMenu.length || invalidCombo.length) {
    throw new Error(
      `IDs inválidos: menu_item_id [${invalidMenu.join(', ')}], combo_id [${invalidCombo.join(', ')}]`
    );
  }

  // Arma filas válidas
  const rows = [];
  for (const it of items) {
    const hasMenu  = !!it.menu_item_id;
    const hasCombo = !!it.combo_id;
    if (!hasMenu && !hasCombo) continue; // ignora líneas sin referencia

    if (hasMenu && !menuValid.has(Number(it.menu_item_id))) continue;
    if (hasCombo && !comboValid.has(Number(it.combo_id))) continue;

    rows.push({
      pedido_id: pedidoId,
      menu_item_id: hasMenu  ? Number(it.menu_item_id) : null,
      combo_id:     hasCombo ? Number(it.combo_id)     : null,
      cantidad: Number(it.cantidad || 1),
      precio_unitario: Number(it.precio_unitario || 0),
    });
  }

  if (!rows.length) return;

  const { error } = await supabase.from('pedido_detalle').insert(rows);
  if (error) throw error;
}


/**
 * POST /api/pedidos
 * Body:
 * {
 *   mesaId?, restaurantId?,
 *   items?: [{ menu_item_id?, combo_id?, cantidad, precio_unitario }],
 *   idempotencyKey?,
 *   total?,                           // si no viene, se calcula de items
 *   comprobanteTipo: "01"|"03",
 *   billingClient: { ... },
 *   billingEmail?
 * }
 * Respuesta: { pedidoId, amount (céntimos), currency: "PEN" }
 */
router.post('/pedidos', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const {
      mesaId,
      restaurantId: _restaurantId,
      items = [],
      idempotencyKey,
      total,
      comprobanteTipo,
      billingClient,
      billingEmail
    } = req.body;

    if (!comprobanteTipo || !['01','03'].includes(comprobanteTipo)) {
      throw new Error('comprobanteTipo requerido ("01"|"03")');
    }
    if (!billingClient) throw new Error('billingClient requerido');

    const restaurantId = await ensureRestaurantId({ restaurantId: _restaurantId, mesaId });

    // Normaliza billing_client
    const billing = normalizeBillingClient(billingClient, comprobanteTipo);

    // Total
    const computedTotal = typeof total === 'number' ? total : computeTotalFromItems(items);
    if (!computedTotal || Number.isNaN(computedTotal)) {
      throw new Error('No se pudo determinar el total del pedido');
    }

    // Crea pedido
    const { data: inserted, error } = await supabase
      .from('pedidos')
      .insert([{
        restaurant_id: restaurantId,
        mesa_id: mesaId ?? null,
        total: computedTotal,
        estado: 'pendiente_pago',
        idempotency_key: idempotencyKey ?? null,
        comprobante_tipo: comprobanteTipo, // "01" | "03"
        billing_client: billing,           // JSON canónico
        billing_email: billingEmail || billing.email || null
      }])
      .select('id,total')
      .maybeSingle();
    if (error) throw error;

    // Inserta detalles si vinieron
   await insertDetallesIfAny(inserted.id, restaurantId, items);

    // Respuesta hacia el front (amount en céntimos para PSP)
    return res.json({
      pedidoId: inserted.id,
      amount: Math.round(Number(inserted.total) * 100),
      currency: 'PEN'
    });
  } catch (e) {
    console.error('POST /api/pedidos error:', e.message);
    return res.status(400).json({ error: e.message });
  }
});

module.exports = router;
