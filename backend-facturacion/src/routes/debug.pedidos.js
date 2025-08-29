// backend-facturacion/src/routes/debug.pedidos.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../services/supabase');

// Vincula el último CPE de un pedido y actualiza solo sunat_estado + cpe_id
router.post('/pedidos/attach-cpe', express.json({ type: '*/*' }), async (req, res) => {
  try {
    const pedidoId = Number(req.body.pedidoId);
    if (!pedidoId) throw new Error('falta pedidoId');

    const { data: last, error: eSel } = await supabase
      .from('cpe_documents')
      .select('id, estado')
      .eq('pedido_id', pedidoId)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eSel) throw eSel;
    if (!last) return res.status(404).json({ ok: false, error: 'Sin CPE para este pedido' });

    const { error: eUpd } = await supabase
      .from('pedidos')
      .update({ cpe_id: last.id, sunat_estado: last.estado })
      .eq('id', pedidoId);
    if (eUpd) throw eUpd;

    res.json({ ok: true, linked: last });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

module.exports = router;
