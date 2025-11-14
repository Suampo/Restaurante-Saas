BEGIN;

-- Crear grupos legacy por combo
INSERT INTO public.combo_grupos (combo_id, categoria_id, nombre_grupo, min_items, max_items, orden)
SELECT c.id, c.categoria_entrada_id, 'Entrada', 1, 1, 1
FROM public.combos c
WHERE c.categoria_entrada_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.combo_grupos (combo_id, categoria_id, nombre_grupo, min_items, max_items, orden)
SELECT c.id, c.categoria_plato_id, 'Plato', 1, 1, 2
FROM public.combos c
WHERE c.categoria_plato_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill combo_grupo_id según tipo legado
-- Entrada
UPDATE public.pedido_detalle_combo_items x
SET combo_grupo_id = cg.id
FROM public.pedido_detalle pd
JOIN public.combo_grupos cg 
  ON cg.combo_id = pd.combo_id AND cg.nombre_grupo = 'Entrada'
WHERE x.pedido_detalle_id = pd.id
  AND x.tipo = 'entrada'
  AND x.combo_grupo_id IS NULL;

-- Plato
UPDATE public.pedido_detalle_combo_items x
SET combo_grupo_id = cg.id
FROM public.pedido_detalle pd
JOIN public.combo_grupos cg 
  ON cg.combo_id = pd.combo_id AND cg.nombre_grupo = 'Plato'
WHERE x.pedido_detalle_id = pd.id
  AND x.tipo = 'plato'
  AND x.combo_grupo_id IS NULL;

COMMIT;
