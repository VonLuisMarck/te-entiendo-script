-- Actualizar el trigger de archivado para incluir los nuevos campos
CREATE OR REPLACE FUNCTION public.archivar_propiedad_antes_borrar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  DECLARE
    ciudad_extraida TEXT;
    distrito_extraido TEXT;
    provincia_extraida TEXT;
  BEGIN
    -- Usar los campos normalizados si están disponibles, si no extraer de ubicacion
    IF OLD.ciudad IS NOT NULL THEN
      ciudad_extraida := OLD.ciudad;
      distrito_extraido := OLD.distrito;
      provincia_extraida := OLD.provincia;
    ELSE
      -- Fallback: extraer de ubicacion como antes
      IF position(',' in OLD.ubicacion) > 0 THEN
        distrito_extraido := trim(split_part(OLD.ubicacion, ',', 1));
        ciudad_extraida := trim(split_part(OLD.ubicacion, ',', 2));
      ELSE
        ciudad_extraida := trim(OLD.ubicacion);
        distrito_extraido := NULL;
      END IF;
      provincia_extraida := NULL;
    END IF;
    
    -- Insertar con ON CONFLICT para evitar duplicados
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
      provincia,
      condition,
      ano_construccion,
      tiene_ascensor,
      tiene_parking,
      tiene_trastero,
      contacto_email,
      contacto_telefono,
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
      provincia_extraida,
      OLD.condition,
      OLD.ano_construccion,
      OLD.tiene_ascensor,
      OLD.tiene_parking,
      OLD.tiene_trastero,
      OLD.contacto_email,
      OLD.contacto_telefono,
      COALESCE(OLD.fecha_scraping, OLD.created_at),
      'borrado'
    )
    ON CONFLICT (external_id, portal_origen) 
    DO UPDATE SET
      fecha_archivado = now(),
      motivo_archivado = 'borrado',
      precio = EXCLUDED.precio,
      precio_m2 = EXCLUDED.precio_m2,
      tiene_trastero = EXCLUDED.tiene_trastero,
      contacto_email = EXCLUDED.contacto_email,
      contacto_telefono = EXCLUDED.contacto_telefono;
  END;
  
  RETURN OLD;
END;
$function$;