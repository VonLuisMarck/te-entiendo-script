-- Eliminar la constraint antigua sobre ciudad,barrio
ALTER TABLE metricas_barrios 
DROP CONSTRAINT IF EXISTS metricas_barrios_ciudad_barrio_key;

-- Crear nuevo índice único sobre provincia, ciudad, barrio
-- Usamos COALESCE para manejar NULLs correctamente
CREATE UNIQUE INDEX IF NOT EXISTS metricas_barrios_unique_location 
ON metricas_barrios (provincia, COALESCE(ciudad, ''), COALESCE(barrio, ''));