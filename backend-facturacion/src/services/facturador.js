// backend-facturacion/src/services/facturador.js
const APISPERU_BASE = process.env.APISPERU_BASE || 'https://facturacion.apisperu.com/api/v1';
const { supabase } = require('./supabase');

async function getEmisorByRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from('sunat_emisores')
    .select('*')
    .eq('restaurant_id', restaurantId)
    // <<< ordena para tomar la fila con token primero y la más reciente
    .order('apiperu_company_token', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Emisor (sunat_emisores) no configurado para el restaurant ' + restaurantId);
  return data;
}

async function emitirInvoice({ restaurantId, cpeBody }) {
  const emisor = await getEmisorByRestaurant(restaurantId);

  // <<< quita espacios/saltos de línea
  const token = (emisor.apiperu_company_token || process.env.APISPERU_FALLBACK_TOKEN || '').trim();
  if (!token) throw new Error('Falta token de empresa (APISPERU)');

  // <<< log corto para depurar qué token y de dónde lo tomó
  console.log(
    '[APISPERU] usando token %s..., origen=%s, ruc=%s',
    token.slice(0, 10),
    emisor.apiperu_company_token ? 'DB' : 'ENV',
    emisor.ruc
  );

  const resp = await fetch(`${APISPERU_BASE}/invoice/send`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cpeBody)
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = json?.message || json?.error || `APISPERU ${resp.status}`;
    const err = new Error(msg);
    err.response = json;
    throw err;
  }
  return json;
}

module.exports = { emitirInvoice, getEmisorByRestaurant };
