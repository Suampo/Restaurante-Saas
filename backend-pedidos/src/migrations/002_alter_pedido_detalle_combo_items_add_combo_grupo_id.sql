-- (agregado a 002_alter_pedido_detalle_combo_items_add_combo_grupo_id.sql)
BEGIN;

ALTER TABLE public.pedido_detalle_combo_items
  ADD COLUMN IF NOT EXISTS combo_grupo_id INTEGER;

ALTER TABLE public.pedido_detalle_combo_items
  ADD CONSTRAINT pedido_detalle_combo_items_combo_grupo_id_fkey
  FOREIGN KEY (combo_grupo_id) REFERENCES public.combo_grupos(id);

CREATE INDEX IF NOT EXISTS idx_ped_det_combo_items_combo_grupo_id
  ON public.pedido_detalle_combo_items(combo_grupo_id);

-- 🔓 Relajar columna legacy 'tipo' para no bloquear N grupos
DO $$
BEGIN
  -- quita NOT NULL si existe
  BEGIN
    ALTER TABLE public.pedido_detalle_combo_items
      ALTER COLUMN tipo DROP NOT NULL;
  EXCEPTION WHEN others THEN
    -- ya era NULLABLE; ignorar
  END;

  -- intenta dropear un posible CHECK nombrado
  BEGIN
    ALTER TABLE public.pedido_detalle_combo_items
      DROP CONSTRAINT IF EXISTS pedido_detalle_combo_items_tipo_check;
  EXCEPTION WHEN others THEN
    -- el nombre puede variar; intentamos detectar y dropear cualquier CHECK sobre 'tipo'
    PERFORM 1 FROM pg_constraint
      WHERE conrelid = 'public.pedido_detalle_combo_items'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%tipo%entrada%plato%';
    IF FOUND THEN
      RAISE EXCEPTION 'Hay un CHECK sobre "tipo" con nombre no estándar: bórralo manualmente desde el SQL editor (Constraints de la tabla) o renómbralo y vuelve a correr esta migración.';
    END IF;
  END;
END$$;

COMMIT;
