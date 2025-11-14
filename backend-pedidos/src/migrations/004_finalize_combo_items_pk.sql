BEGIN;

ALTER TABLE public.pedido_detalle_combo_items
  ALTER COLUMN combo_grupo_id SET NOT NULL;

ALTER TABLE public.pedido_detalle_combo_items
  DROP COLUMN IF EXISTS tipo;

ALTER TABLE public.pedido_detalle_combo_items
  DROP CONSTRAINT IF EXISTS pedido_detalle_combo_items_pkey;

ALTER TABLE public.pedido_detalle_combo_items
  ADD CONSTRAINT pedido_detalle_combo_items_pkey
  PRIMARY KEY (pedido_detalle_id, combo_grupo_id, menu_item_id);

COMMIT;
