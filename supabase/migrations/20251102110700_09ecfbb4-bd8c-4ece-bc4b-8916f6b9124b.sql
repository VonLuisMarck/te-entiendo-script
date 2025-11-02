-- Añadir columna last_seen a propiedades
ALTER TABLE propiedades 
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_propiedades_last_seen ON propiedades(last_seen);
CREATE INDEX IF NOT EXISTS idx_propiedades_portal_activo ON propiedades(portal_origen, activo);

-- Función para actualizar last_seen automáticamente en cada update
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_seen = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Trigger que actualiza last_seen cuando se modifica una propiedad
CREATE TRIGGER trigger_update_last_seen
  BEFORE UPDATE ON propiedades
  FOR EACH ROW
  WHEN (
    OLD.precio IS DISTINCT FROM NEW.precio OR
    OLD.metros IS DISTINCT FROM NEW.metros OR
    OLD.titulo IS DISTINCT FROM NEW.titulo
  )
  EXECUTE FUNCTION update_last_seen();

-- Función para desactivar propiedades no vistas en los últimos X días
CREATE OR REPLACE FUNCTION desactivar_propiedades_no_vistas(
  p_dias_limite INTEGER DEFAULT 2,
  p_portal TEXT DEFAULT NULL,
  p_ubicacion TEXT DEFAULT NULL
)
RETURNS TABLE (
  propiedades_desactivadas INTEGER,
  propiedades_archivadas INTEGER
) AS $$
DECLARE
  v_desactivadas INTEGER := 0;
  v_archivadas INTEGER := 0;
BEGIN
  -- Desactivar propiedades no vistas
  UPDATE propiedades
  SET activo = false
  WHERE activo = true
    AND last_seen < now() - (p_dias_limite || ' days')::INTERVAL
    AND (p_portal IS NULL OR portal_origen = p_portal)
    AND (p_ubicacion IS NULL OR ubicacion ILIKE '%' || p_ubicacion || '%');
  
  GET DIAGNOSTICS v_desactivadas = ROW_COUNT;
  
  -- Archivar las propiedades inactivas
  SELECT archivar_propiedades_inactivas() INTO v_archivadas;
  
  RETURN QUERY SELECT v_desactivadas, v_archivadas;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';