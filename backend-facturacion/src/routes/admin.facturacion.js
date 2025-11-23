// backend-facturacion/src/routes/admin.facturacion.js
const express = require("express");
const requireWaiter = require("../middlewares/requireWaiter");
const { listarCpeDocuments } = require("../controllers/facturacionController");

// Usamos Supabase + facturador para generar el PDF al vuelo
const { supabase } = require("../services/supabase");
const { getEmisorByRestaurant } = require("../services/facturador");

const APISPERU_BASE =
  process.env.APISPERU_BASE || "https://facturacion.apisperu.com/api/v1";

const router = express.Router();

/**
 * GET /admin/cpe-documents
 * Lista de comprobantes + resumen
 */
router.get("/cpe-documents", requireWaiter, listarCpeDocuments);

/**
 * GET /admin/cpe/:id/pdf
 * Devuelve el PDF del CPE (inline) para el admin/staff autenticado.
 * - Busca el CPE en cpe_documents
 * - Llama a ApisPeru /invoice/pdf con raw_request
 * - Devuelve application/pdf
 */
router.get("/cpe/:id/pdf", requireWaiter, async (req, res) => {
  try {
    const cpeId = Number(req.params.id);
    if (!cpeId) throw new Error("cpeId inválido");

    const { data: cpe, error } = await supabase
      .from("cpe_documents")
      .select("id, restaurant_id, raw_request, serie, correlativo")
      .eq("id", cpeId)
      .maybeSingle();

    if (error) throw error;
    if (!cpe) throw new Error("CPE no encontrado");

    const emisor = await getEmisorByRestaurant(cpe.restaurant_id);

    const token = (
      emisor.apiperu_company_token ||
      process.env.APISPERU_FALLBACK_TOKEN ||
      ""
    ).trim();

    // 👇 LOG PARA VER QUÉ SE ESTÁ MANDANDO
    console.log("[CPE PDF] cpeId=%s restId=%s tokenPreview=%s len=%d",
      cpe.id,
      cpe.restaurant_id,
      token.slice(0, 10),
      token.length
    );

    if (!token) {
      // aquí NUNCA deberías llegar con la config que muestras
      return res.status(500).json({
        ok: false,
        error: `Token de ApisPeru vacío para restaurant ${cpe.restaurant_id}`,
      });
    }

    const r = await fetch(`${APISPERU_BASE}/invoice/pdf`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/pdf",
      },
      body: JSON.stringify(cpe.raw_request),
    });

    const buf = Buffer.from(await r.arrayBuffer());

    if (!r.ok) {
      // 👇 LOG DEL ERROR REAL QUE DEVUELVE APISPERU
      console.error(
        "[CPE PDF] error ApisPeru status=%s body=%s",
        r.status,
        buf.toString("utf8")
      );

      let err;
      try {
        err = JSON.parse(buf.toString("utf8"));
      } catch {
        err = { message: "No se pudo generar PDF" };
      }
      return res.status(400).json({
        ok: false,
        status: r.status,
        error: err,
      });
    }

    const filename = `${cpe.serie || "CPE"}-${String(
      cpe.correlativo || ""
    ).padStart(8, "0")}.pdf`;

    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `inline; filename="${filename}"`);

    return res.send(buf);
  } catch (e) {
    console.error("Error en GET /admin/cpe/:id/pdf", e);
    return res.status(400).json({ ok: false, error: e.message });
  }
});

module.exports = router;
