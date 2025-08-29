// backend-facturacion/src/services/cpe.js
const { supabase } = require('./supabase');

function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

function moneyPartsFromUnitPrice(priceWithIgv, qty) {
  const pWith = Number(priceWithIgv);
  const pBase = round2(pWith / 1.18);
  const base = round2(pBase * qty);
  const igv = round2(base * 0.18);
  const price = round2(pWith);
  const priceTotal = round2(price * qty);
  return { pBase, base, igv, price, priceTotal };
}

async function getPedidoCompleto(pedidoId) {
  const { data: pedido, error: e1 } = await supabase
    .from('pedidos').select('*').eq('id', pedidoId).maybeSingle();
  if (e1) throw e1;
  if (!pedido) throw new Error('Pedido no encontrado');

  const { data: detalles, error: e2 } = await supabase
    .from('pedido_detalle')
    .select(`
      id,
      cantidad,
      precio_unitario,
      menu_item_id,
      combo_id,
      menu_items:menu_items!pedido_detalle_menu_item_id_fkey ( nombre ),
      combos:combos!pedido_detalle_combo_id_fkey ( nombre )
    `)
    .eq('pedido_id', pedidoId);
  if (e2) throw e2;

  return { pedido, detalles };
}

function buildDetailsFromDB(detalles) {
  const lines = [];
  for (const d of detalles) {
    const qty = Number(d.cantidad || 1);
    const unit = Number(d.precio_unitario || 0); // con IGV
    const desc = d?.menu_items?.nombre || d?.combos?.nombre || 'Item';
    const parts = moneyPartsFromUnitPrice(unit, qty);
    lines.push({
      unidad: 'UNI',
      descripcion: desc,
      cantidad: qty,
      mtoValorUnitario: parts.pBase,
      mtoValorVenta: parts.base,
      mtoBaseIgv: parts.base,
      porcentajeIgv: 18,
      igv: parts.igv,
      tipAfeIgv: 10,
      mtoPrecioUnitario: unit,
      totalImpuestos: parts.igv
    });
  }
  return lines;
}

function totalsFromDetails(lines) {
  const valorVenta = round2(lines.reduce((s, l) => s + Number(l.mtoValorVenta || 0), 0));
  const mtoIGV = round2(lines.reduce((s, l) => s + Number(l.igv || 0), 0));
  const mtoImpVenta = round2(valorVenta + mtoIGV);
  return {
    mtoOperGravadas: valorVenta,
    mtoIGV,
    valorVenta,
    totalImpuestos: mtoIGV,
    subTotal: mtoImpVenta,
    mtoImpVenta
  };
}

function legendEnLetras(total) {
  const fixed = Number(total).toFixed(2);
  return `SON ${fixed} SOLES`;
}

function normalizeClient(billing) {
  const c = { ...billing };
  // Factura (RUC) exige razón social
  if (c.tipoDoc === '6' && !c.rznSocial) c.rznSocial = 'Cliente RUC';
  // Boleta: si no hay rznSocial, usar nombres+apellidos o "Cliente"
  if (c.tipoDoc !== '6' && !c.rznSocial) {
    const full = [c.nombres, c.apellidos].filter(Boolean).join(' ').trim();
    c.rznSocial = full || 'Cliente';
  }
  if (!c.email) c.email = billing?.email || '';
  return c;
}

function companyFromEmisor(emisor) {
  return {
    ruc: emisor.ruc,
    razonSocial: emisor.razon_social,
    nombreComercial: emisor.nombre_comercial || emisor.razon_social,
    address: {
      ubigeo: emisor.ubigeo || '',     // ¡ojo: "ubigeo"
      departamento: emisor.departamento || '',
      provincia: emisor.provincia || '',
      distrito: emisor.distrito || '',
      urbanizacion: emisor.urbanizacion || '',
      direccion: emisor.direccion || ''
    }
  };
}

function nowLimaISO() {
  // ISO con zona -05:00
  const z = new Date();
  const tz = -5;
  const y = z.getUTCFullYear();
  const m = String(z.getUTCMonth() + 1).padStart(2, '0');
  const d = String(z.getUTCDate()).padStart(2, '0');
  const hh = String((z.getUTCHours() + 24 + tz) % 24).padStart(2, '0');
  const mm = String(z.getUTCMinutes()).padStart(2, '0');
  const ss = String(z.getUTCSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}T${hh}:${mm}:${ss}-05:00`;
}

/**
 * Construye el CPE para APIsPERU.
 * Si no hay detalles en DB, crea UNA línea fallback con el total del pedido.
 */
function buildCPE({ tipoDoc, serie, correlativo, fechaEmisionISO, emisor, billing, detalles, pedido }) {
  let details = buildDetailsFromDB(detalles);

  // Fallback: si no hay líneas o el total de líneas es 0 → una línea por el total del pedido
  const sumLines = details.reduce((s, l) => s + Number(l.mtoPrecioUnitario || 0) * Number(l.cantidad || 1), 0);
  const totalPedido = Number(pedido?.total || 0);
  if (!details.length || round2(sumLines) === 0) {
    const unit = round2(totalPedido);
    const parts = moneyPartsFromUnitPrice(unit, 1);
    details = [{
      unidad: 'UNI',
      descripcion: 'Consumo restaurante',
      cantidad: 1,
      mtoValorUnitario: parts.pBase,
      mtoValorVenta: parts.base,
      mtoBaseIgv: parts.base,
      porcentajeIgv: 18,
      igv: parts.igv,
      tipAfeIgv: 10,
      mtoPrecioUnitario: unit,
      totalImpuestos: parts.igv
    }];
  }

  const tot = totalsFromDetails(details);
  const client = normalizeClient(billing);

  const body = {
    ublVersion: '2.1',
    tipoOperacion: '0101',
    tipoDoc,                // '01' Factura | '03' Boleta
    serie,
    correlativo: String(correlativo),
    fechaEmision: fechaEmisionISO || nowLimaISO(),
    tipoMoneda: 'PEN',
    company: companyFromEmisor(emisor),
    client,
    ...tot,
    details,
    legends: [{ code: '1000', value: legendEnLetras(tot.mtoImpVenta) }]
  };
  return { body, totals: tot };
}

module.exports = { getPedidoCompleto, buildCPE, nowLimaISO };
