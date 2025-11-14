BEGIN;
CREATE INDEX IF NOT EXISTS idx_menu_items_categoria_id ON public.menu_items(categoria_id);
CREATE INDEX IF NOT EXISTS idx_ped_det_combo_items_pedido ON public.pedido_detalle_combo_items(pedido_detalle_id);
COMMIT;
