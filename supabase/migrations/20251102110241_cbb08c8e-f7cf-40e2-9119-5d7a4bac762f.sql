-- Primero eliminar duplicados manteniendo solo el más reciente
DELETE FROM propiedades_historico a
USING propiedades_historico b
WHERE a.id < b.id 
  AND a.external_id = b.external_id 
  AND a.portal_origen = b.portal_origen
  AND a.external_id IS NOT NULL;

-- Añadir constraint única para evitar duplicados futuros
ALTER TABLE propiedades_historico 
ADD CONSTRAINT unique_propiedad_historico 
UNIQUE (external_id, portal_origen);

-- Actualizar la función de archivo para usar UPSERT
CREATE OR REPLACE FUNCTION public.archivar_propiedad_antes_borrar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DECLARE
    ciudad_extraida TEXT;
    distrito_extraido TEXT;
  BEGIN
    -- Extraer ciudad y distrito
    IF position(',' in OLD.ubicacion) > 0 THEN
      distrito_extraido := trim(split_part(OLD.ubicacion, ',', 1));
      ciudad_extraida := trim(split_part(OLD.ubicacion, ',', 2));
    ELSE
      ciudad_extraida := trim(OLD.ubicacion);
      distrito_extraido := NULL;
    END IF;
    
    -- Usar INSERT ... ON CONFLICT para evitar duplicados
    INSERT INTO public.propiedades_historico (
      propiedad_id,
      external_id,
      portal_origen,
      precio,
      precio_m2,
      metros,
      dormitorios,
      banos,
      tipo_propiedad,
      ubicacion,
      ciudad,
      distrito,
      condition,
      ano_construccion,
      tiene_ascensor,
      tiene_parking,
      fecha_propiedad,
      motivo_archivado
    ) VALUES (
      OLD.id,
      OLD.external_id,
      OLD.portal_origen,
      OLD.precio,
      OLD.precio_m2,
      OLD.metros,
      OLD.dormitorios,
      OLD.banos,
      OLD.tipo_propiedad,
      OLD.ubicacion,
      ciudad_extraida,
      distrito_extraido,
      OLD.condition,
      OLD.ano_construccion,
      OLD.tiene_ascensor,
      OLD.tiene_parking,
      COALESCE(OLD.fecha_scraping, OLD.created_at),
      'borrado'
    )
    ON CONFLICT (external_id, portal_origen) 
    DO UPDATE SET
      fecha_archivado = now(),
      motivo_archivado = 'borrado',
      precio = EXCLUDED.precio,
      precio_m2 = EXCLUDED.precio_m2;
  END;
  
  RETURN OLD;
END;
$function$;