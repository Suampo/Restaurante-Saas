// backend-facturacion/src/controllers/facturacionController.js
const pool = require("../db");

/**
 * GET /admin/cpe-documents
 * Lista comprobantes electrónicos del restaurante autenticado
 */
async function listarCpeDocuments(req, res) {
  try {
    // requireWaiter ya coloca esto en req.user / req.sessionRestaurantId
    const restaurantId =
      Number(req.user?.restaurantId || req.sessionRestaurantId || 0);

    if (!restaurantId) {
      return res.status(401).json({ error: "RestaurantId requerido" });
    }

    const {
      q = "",
      tipo = "all",   // '01' factura, '03' boleta, 'all'
      estado = "all", // 'ACEPTADO', 'RECHAZADO', etc. o 'all'
      from,
      to,
    } = req.query;

    const params = [restaurantId];
    let where = "c.restaurant_id = $1";

    if (tipo !== "all") {
      params.push(tipo);
      where += ` AND c.tipo_doc = $${params.length}`;
    }

    if (estado !== "all") {
      params.push(estado.toUpperCase());
      where += ` AND UPPER(c.estado) = $${params.length}`;
    }

    if (from) {
      params.push(from);
      where += ` AND c.fecha_emision >= $${params.length}::date`;
    }

    if (to) {
      params.push(to);
      // menor al día siguiente para incluir todo el día "to"
      where += ` AND c.fecha_emision < ($${params.length}::date + INTERVAL '1 day')`;
    }

    if (q) {
      const like = `%${q}%`;

      // vamos a añadir 3 parámetros más
      const idxSerie  = params.length + 1;
      const idxNombre = params.length + 2;
      const idxDoc    = params.length + 3;

      params.push(like, like, like);

      where += ` AND (
        (c.serie || '-' || LPAD(c.correlativo::text, 8, '0')) ILIKE $${idxSerie}
        OR (c.client->>'razon_social') ILIKE $${idxNombre}
        OR COALESCE(
          c.client->>'num_doc',
          c.client->>'ruc',
          c.client->>'dni'
        ) ILIKE $${idxDoc}
      )`;
    }

    const baseFrom = `
      FROM public.cpe_documents c
      WHERE ${where}
    `;

    const sqlItems = `
      SELECT
        c.id,
        c.tipo_doc,
        c.serie,
        c.correlativo,
        c.fecha_emision,
        c.moneda,
        c.subtotal,
        c.igv,
        c.total,
        c.estado,
        c.pdf_url,
        c.xml_url,
        c.cdr_url,
        c.client
      ${baseFrom}
      ORDER BY c.fecha_emision DESC, c.id DESC
      LIMIT 300;
    `;

    const sqlSummary = `
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(c.total),0) AS total_amount,
        COUNT(*) FILTER (WHERE c.tipo_doc = '01') AS facturas,
        COUNT(*) FILTER (WHERE c.tipo_doc = '03') AS boletas
      ${baseFrom};
    `;

    const [itemsResult, summaryResult] = await Promise.all([
      pool.query(sqlItems, params),
      pool.query(sqlSummary, params),
    ]);

    const summary = summaryResult.rows[0] || {
      total: 0,
      total_amount: 0,
      facturas: 0,
      boletas: 0,
    };

    res.json({
      items: itemsResult.rows,
      summary: {
        total: Number(summary.total || 0),
        totalAmount: Number(summary.total_amount || 0),
        facturas: Number(summary.facturas || 0),
        boletas: Number(summary.boletas || 0),
      },
    });
  } catch (e) {
    console.error("listarCpeDocuments:", e);
    res.status(500).json({ error: "No se pudo obtener la facturación" });
  }
}

module.exports = {
  listarCpeDocuments,
};
