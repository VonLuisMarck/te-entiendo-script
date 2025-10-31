-- Añadir columna provincia a metricas_barrios
ALTER TABLE metricas_barrios 
ADD COLUMN IF NOT EXISTS provincia text;

-- Actualizar datos existentes para extraer provincia de ciudad
UPDATE metricas_barrios 
SET provincia = ciudad 
WHERE provincia IS NULL;

-- Hacer provincia NOT NULL después de poblar datos existentes
ALTER TABLE metricas_barrios 
ALTER COLUMN provincia SET NOT NULL;

-- Añadir columna provincia a metricas_barrios_historico
ALTER TABLE metricas_barrios_historico 
ADD COLUMN IF NOT EXISTS provincia text;

-- Actualizar histórico
UPDATE metricas_barrios_historico 
SET provincia = ciudad 
WHERE provincia IS NULL;

-- Crear índice para consultas por provincia
CREATE INDEX IF NOT EXISTS idx_metricas_provincia ON metricas_barrios(provincia);
CREATE INDEX IF NOT EXISTS idx_metricas_historico_provincia ON metricas_barrios_historico(provincia);

-- Comentarios para documentar
COMMENT ON COLUMN metricas_barrios.provincia IS 'Provincia de la ubicación (Murcia, Madrid, etc.) - para métricas nacionales';
COMMENT ON COLUMN metricas_barrios.ciudad IS 'Ciudad específica dentro de la provincia - null si no se puede determinar';
COMMENT ON COLUMN metricas_barrios.barrio IS 'Barrio específico - null si no se puede determinar (evita contaminar métricas)';