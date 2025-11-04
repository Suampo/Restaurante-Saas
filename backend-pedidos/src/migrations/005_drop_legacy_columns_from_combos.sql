BEGIN;

ALTER TABLE public.combos
  DROP COLUMN IF EXISTS categoria_entrada_id,
  DROP COLUMN IF EXISTS categoria_plato_id;

COMMIT;
