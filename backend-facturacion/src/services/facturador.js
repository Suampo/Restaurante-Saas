// backend-facturacion/src/services/facturador.js
const APISPERU_BASE =
  process.env.APISPERU_BASE || "https://facturacion.apisperu.com/api/v1";

const { supabase } = require("./supabase");

/**
 * Devuelve la fila de sunat_emisores asociada al restaurant.
 * Toma la más reciente que tenga token de empresa.
 */
async function getEmisorByRestaurant(restaurantId) {
  const { data, error } = await supabase
    .from("sunat_emisores")
    .select("*")
    .eq("restaurant_id", Number(restaurantId))
    .order("apiperu_company_token", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      `Emisor (sunat_emisores) no configurado para el restaurant ${restaurantId}`
    );
  }

  if (!data.ruc) {
    throw new Error(
      `Emisor de restaurant ${restaurantId} sin RUC configurado`
    );
  }

  return data;
}

/**
 * Envía el comprobante a ApisPeru y guarda/actualiza el registro
 * en la tabla cpe_documents. Devuelve { cpeId, estado }.
 *
 * @param {Object} params
 * @param {number} params.restaurantId
 * @param {number} [params.pedidoId]
 * @param {Object} params.cpeBody
 */
async function emitirInvoice({ restaurantId, pedidoId, cpeBody }) {
  if (!restaurantId) {
    throw new Error("emitirInvoice: restaurantId requerido");
  }

  const emisor = await getEmisorByRestaurant(restaurantId);

  // Token de empresa (ApisPeru)
  const token = (
    emisor.apiperu_company_token ||
    process.env.APISPERU_FALLBACK_TOKEN ||
    ""
  ).trim();

  if (!token) {
    throw new Error(
      `Falta token de empresa (APISPERU) para restaurant ${restaurantId}`
    );
  }

  console.log(
    "[APISPERU] usando token %s..., origen=%s, ruc=%s",
    token.slice(0, 10),
    emisor.apiperu_company_token ? "DB" : "ENV",
    emisor.ruc
  );

  // --- 1) Enviar a ApisPeru ---
  const resp = await fetch(`${APISPERU_BASE}/invoice/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cpeBody),
  });

  const rawText = await resp.text();
  let json;
  try {
    json = rawText ? JSON.parse(rawText) : {};
  } catch {
    json = { raw: rawText };
  }

  if (!resp.ok) {
    const msg = json?.message || json?.error || `APISPERU ${resp.status}`;
    const err = new Error(msg);
    err.response = json;
    throw err;
  }

  // --- 2) Mapear estado SUNAT aproximado ---
  let estado = "ENVIADO";
  try {
    const sr = json.sunat_response || json.sunat || null;
    if (sr && typeof sr.success === "boolean") {
      estado = sr.success ? "ACEPTADO" : "RECHAZADO";
    } else if (json.accepted || json.aceptado) {
      estado = "ACEPTADO";
    }
  } catch {
    estado = "ENVIADO";
  }

  // --- 3) Extraer datos básicos del CPE desde el body ---
  const tipo_doc = String(
    cpeBody.tipo_de_comprobante ||
      cpeBody.tipo_documento ||
      cpeBody.tipo_comprobante ||
      ""
  )
    .padStart(2, "0")
    .trim();

  const serie = String(
    cpeBody.serie ||
      cpeBody.serie_comprobante ||
      cpeBody.serie_documento ||
      ""
  ).trim();

  const correlativo = Number(
    cpeBody.numero ||
      cpeBody.numero_comprobante ||
      cpeBody.correlativo ||
      0
  );

  if (!tipo_doc || !serie || !correlativo) {
    console.warn(
      "[emitirInvoice] CPE sin tipo_doc/serie/correlativo válidos, no se guardará en cpe_documents"
    );
    return { cpeId: null, estado };
  }

  const moneda =
    cpeBody.moneda ||
    cpeBody.tipo_de_moneda ||
    "PEN";

  const fecha_emision =
    cpeBody.fecha_de_emision ||
    cpeBody.fecha_emision ||
    new Date().toISOString();

  const subtotal =
    Number(
      cpeBody.total_gravada ||
        cpeBody.subtotal ||
        cpeBody.subtotal_venta ||
        0
    ) || null;

  const igv =
    Number(
      cpeBody.total_igv ||
        cpeBody.igv ||
        0
    ) || null;

  const total =
    Number(
      cpeBody.total ||
        cpeBody.total_venta ||
        cpeBody.importe_total ||
        0
    ) || null;

  const client =
    cpeBody.datos_del_cliente_o_receptor ||
    cpeBody.client ||
    null;

  // --- 4) Guardar / actualizar cpe_documents ---
  let cpeRow = null;
  try {
    const { data, error } = await supabase
      .from("cpe_documents")
      .upsert(
        [
          {
            restaurant_id: Number(restaurantId),
            pedido_id: pedidoId || null,
            tipo_doc,
            serie,
            correlativo,
            fecha_emision,
            moneda,
            subtotal,
            igv,
            total,
            estado,
            client,
            raw_request: cpeBody,
            raw_response: json,
          },
        ],
        { onConflict: "pedido_id" }
      )
      .select("id, estado")
      .maybeSingle();

    if (error) {
      console.error(
        "[emitirInvoice] error guardando en cpe_documents:",
        error.message
      );
    } else {
      cpeRow = data;
    }
  } catch (e) {
    console.error("[emitirInvoice] excepción al guardar CPE:", e.message);
  }

  const cpeId = cpeRow?.id || null;
  return { cpeId, estado };
}

module.exports = { emitirInvoice, getEmisorByRestaurant };
