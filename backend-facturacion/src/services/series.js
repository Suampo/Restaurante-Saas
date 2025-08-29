// backend-facturacion/src/services/series.js
const { supabase } = require('./supabase');

async function reservarCorrelativo(restaurantId, tipoDoc) {
  const { data, error } = await supabase.rpc('next_correlativo', {
    p_restaurant_id: restaurantId,
    p_tipo_doc: tipoDoc
  });
  if (error) throw error;
  // data puede venir como [{ serie, correlativo }]
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('No se pudo reservar correlativo');
  return row; // { serie, correlativo }
}

module.exports = { reservarCorrelativo };
