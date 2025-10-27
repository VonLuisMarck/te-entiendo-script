-- Añadir constraint único para evitar duplicados por external_id + portal_origen
-- Primero eliminamos cualquier duplicado existente (manteniendo el más reciente)
WITH duplicados AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY external_id, portal_origen ORDER BY created_at DESC) as rn
  FROM public.propiedades
)
DELETE FROM public.propiedades
WHERE id IN (
  SELECT id FROM duplicados WHERE rn > 1
);

-- Ahora creamos el constraint único
ALTER TABLE public.propiedades
ADD CONSTRAINT propiedades_external_id_portal_unique 
UNIQUE (external_id, portal_origen);

-- Crear índice para mejorar el rendimiento de búsquedas
CREATE INDEX IF NOT EXISTS idx_propiedades_external_portal 
ON public.propiedades (external_id, portal_origen);