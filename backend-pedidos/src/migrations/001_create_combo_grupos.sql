BEGIN;

CREATE TABLE IF NOT EXISTS public.combo_grupos (
  id            SERIAL PRIMARY KEY,
  combo_id      INTEGER NOT NULL REFERENCES public.combos(id) ON DELETE CASCADE,
  categoria_id  INTEGER NOT NULL REFERENCES public.categorias(id),
  nombre_grupo  TEXT,
  min_items     INTEGER NOT NULL DEFAULT 1 CHECK (min_items >= 0),
  max_items     INTEGER NOT NULL DEFAULT 1 CHECK (max_items >= 1),
  orden         INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_combo_grupos_combo_id     ON public.combo_grupos(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_grupos_categoria_id ON public.combo_grupos(categoria_id);

COMMIT;
