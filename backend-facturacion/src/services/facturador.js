// backend-facturacion/src/services/facturador.js
"use strict";

const APISPERU_BASE =
  process.env.APISPERU_BASE || "https://facturacion.apisperu.com/api/v1";
const { supabase } = require("./supabase");

/**
 * Devuelve la configuración del emisor SUNAT para un restaurante.
 * Lanza errores claros si falta algo crítico (ruc, token, etc.).
 */
async function getEmisorByRestaurant(restaurantId) {
  const rid = Number(restaurantId);

  if (!rid) {
    throw new Error(
      `getEmisorByRestaurant: restaurantId inválido (${restaurantId})`
    );
  }

  const { data, error } = await supabase
    .from("sunat_emisores")
    .select("*")
    .eq("restaurant_id", rid)
    // toma primero el que tiene token y el más reciente
    .order("apiperu_company_token", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Error leyendo sunat_emisores para restaurant_id=${rid}: ${error.message}`
    );
  }

  if (!data) {
    throw new Error(
      `No se encontró configuración SUNAT (sunat_emisores) para restaurant_id=${rid}`
    );
  }

  if (!data.ruc) {
    throw new Error(
      `Emisor SUNAT sin RUC para restaurant_id=${rid} (revisa tabla sunat_emisores)`
    );
  }

  const token = (
    data.apiperu_company_token ||
    process.env.APISPERU_FALLBACK_TOKEN ||
    ""
  ).trim();

  if (!token) {
    throw new Error(
      `Emisor SUNAT sin apiperu_company_token ni APISPERU_FALLBACK_TOKEN para restaurant_id=${rid}`
    );
  }

  return data;
}

/**
 * Envía el comprobante a ApisPeru y registra el CPE en la tabla cpe_documents.
 *
 * Recibe:
 *   - restaurantId: id del restaurante
 *   - cpeBody: JSON que espera ApisPeru en /invoice/send
 *   - pedidoId (opcional): para enlazar el CPE al pedido en pedidos.cpe_id
 *
 * Devuelve:
 *   { cpeId, estado, response }  donde:
 *     - cpeId: id en cpe_documents (o null si algo falló al guardar)
 *     - estado: estado interno del CPE (ACEPTADO, ENVIADO, etc. o fallback)
 *     - response: respuesta cruda de ApisPeru
 */
async function emitirInvoice({ restaurantId, cpeBody, pedidoId = null }) {
  const rid = Number(restaurantId);
  if (!rid) throw new Error("emitirInvoice: restaurantId requerido");

  const emisor = await getEmisorByRestaurant(rid);

  const token = (
    emisor.apiperu_company_token ||
    process.env.APISPERU_FALLBACK_TOKEN ||
    ""
  ).trim();

  if (!token) throw new Error("Falta token de empresa (APISPERU)");

  // Log corto para debug
  console.log(
    "[APISPERU] usando token %s..., origen=%s, ruc=%s",
    token.slice(0, 10),
    emisor.apiperu_company_token ? "DB" : "ENV",
    emisor.ruc
  );

  // 1) Enviar a ApisPeru
  const resp = await fetch(`${APISPERU_BASE}/invoice/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cpeBody),
  });

  const json = await resp.json().catch(() => ({}));

  if (!resp.ok) {
    const msg = json?.message || json?.error || `APISPERU ${resp.status}`;
    const err = new Error(msg);
    err.response = json;
    throw err;
  }

  // 2) Intentar guardar en cpe_documents
  //    (muchos campos son best-effort porque el formato de ApisPeru puede variar)
  const tipoDoc =
    cpeBody.tipo_de_comprobante ||
    cpeBody.tipo_doc ||
    cpeBody.tipoDocumento ||
    null;

  const serie =
    cpeBody.serie ||
    cpeBody.serie_comprobante ||
    cpeBody.serieDocumento ||
    "B001";

  const correlativoRaw =
    cpeBody.numero ||
    cpeBody.numero_comprobante ||
    cpeBody.numeroDocumento ||
    cpeBody.correlativo ||
    0;

  const correlativo = Number(correlativoRaw) || 0;

  const moneda = cpeBody.moneda || "PEN";

  const subtotal =
    cpeBody.total_gravada ??
    cpeBody.total_opgravadas ??
    cpeBody.subtotal ??
    null;

  const igv = cpeBody.total_igv ?? cpeBody.igv ?? null;

  const total =
    cpeBody.total ??
    cpeBody.total_venta ??
    cpeBody.monto_total ??
    cpeBody.importe_total ??
    null;

  const estado =
    json.estado || json.status || json.code || "ENVIADO";

  const client =
    cpeBody.datos_del_cliente ||
    cpeBody.datos_del_cliente_o_receptor ||
    cpeBody.client ||
    cpeBody.cliente ||
    null;

  let cpeRow = null;

  try {
    const insertPayload = {
      restaurant_id: rid,
      pedido_id: pedidoId || null,
      tipo_doc: tipoDoc || "03",
      serie,
      correlativo,
      moneda,
      subtotal,
      igv,
      total,
      estado,
      client,
      raw_request: cpeBody,
      raw_response: json,
    };

    const { data, error } = await supabase
      .from("cpe_documents")
      .insert([insertPayload])
      .select("id, estado")
      .maybeSingle();

    if (error) {
      console.warn(
        "[emitirInvoice] warning al guardar en cpe_documents:",
        error.message
      );
    } else {
      cpeRow = data;
    }
  } catch (e) {
    console.warn(
      "[emitirInvoice] excepción al guardar en cpe_documents:",
      e.message
    );
  }

  return {
    cpeId: cpeRow?.id || null,
    estado: cpeRow?.estado || estado,
    response: json,
  };
}

module.exports = { emitirInvoice, getEmisorByRestaurant };
