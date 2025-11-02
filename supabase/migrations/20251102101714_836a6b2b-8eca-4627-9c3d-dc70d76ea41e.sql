-- Crear tabla de histórico de propiedades para análisis de mercado
CREATE TABLE public.propiedades_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propiedad_id UUID,
  external_id TEXT,
  portal_origen TEXT NOT NULL,
  
  -- Datos clave para análisis de mercado
  precio NUMERIC NOT NULL,
  precio_m2 NUMERIC,
  metros NUMERIC,
  dormitorios INTEGER,
  banos INTEGER,
  tipo_propiedad TEXT NOT NULL,
  
  -- Ubicación
  ubicacion TEXT NOT NULL,
  ciudad TEXT,
  distrito TEXT,
  provincia TEXT,
  
  -- Metadatos
  condition TEXT,
  ano_construccion INTEGER,
  tiene_ascensor BOOLEAN,
  tiene_parking BOOLEAN,
  
  -- Timestamps
  fecha_propiedad TIMESTAMP WITH TIME ZONE NOT NULL, -- Cuándo se scrapeó originalmente
  fecha_archivado TIMESTAMP WITH TIME ZONE DEFAULT now(), -- Cuándo se archivó
  motivo_archivado TEXT, -- 'borrado', 'desactivado', 'actualizado'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para análisis rápido
CREATE INDEX idx_propiedades_historico_ciudad ON public.propiedades_historico(ciudad);
CREATE INDEX idx_propiedades_historico_distrito ON public.propiedades_historico(ciudad, distrito);
CREATE INDEX idx_propiedades_historico_tipo ON public.propiedades_historico(tipo_propiedad);
CREATE INDEX idx_propiedades_historico_fecha ON public.propiedades_historico(fecha_propiedad);
CREATE INDEX idx_propiedades_historico_precio_m2 ON public.propiedades_historico(precio_m2) WHERE precio_m2 IS NOT NULL;

-- RLS: Solo service role y admins pueden leer el histórico
ALTER TABLE public.propiedades_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role puede gestionar histórico"
ON public.propiedades_historico
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Cualquiera puede ver histórico"
ON public.propiedades_historico
FOR SELECT
USING (true);

-- Trigger para archivar automáticamente antes de borrar
CREATE OR REPLACE FUNCTION public.archivar_propiedad_antes_borrar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Extraer ciudad y distrito de ubicacion
  DECLARE
    ciudad_extraida TEXT;
    distrito_extraido TEXT;
  BEGIN
    -- Formato esperado: "Distrito, Ciudad" o "Ciudad"
    IF position(',' in OLD.ubicacion) > 0 THEN
      distrito_extraido := trim(split_part(OLD.ubicacion, ',', 1));
      ciudad_extraida := trim(split_part(OLD.ubicacion, ',', 2));
    ELSE
      ciudad_extraida := trim(OLD.ubicacion);
      distrito_extraido := NULL;
    END IF;
    
    -- Insertar en histórico
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
    );
  END;
  
  RETURN OLD;
END;
$$;

-- Aplicar trigger a la tabla propiedades
CREATE TRIGGER trigger_archivar_antes_borrar
BEFORE DELETE ON public.propiedades
FOR EACH ROW
EXECUTE FUNCTION public.archivar_propiedad_antes_borrar();

-- Función auxiliar para archivar propiedades desactivadas manualmente
CREATE OR REPLACE FUNCTION public.archivar_propiedades_inactivas()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  archivadas INTEGER := 0;
  prop RECORD;
  ciudad_extraida TEXT;
  distrito_extraido TEXT;
BEGIN
  FOR prop IN 
    SELECT * FROM public.propiedades 
    WHERE activo = false 
    AND id NOT IN (SELECT propiedad_id FROM public.propiedades_historico WHERE propiedad_id IS NOT NULL)
  LOOP
    -- Extraer ciudad y distrito
    IF position(',' in prop.ubicacion) > 0 THEN
      distrito_extraido := trim(split_part(prop.ubicacion, ',', 1));
      ciudad_extraida := trim(split_part(prop.ubicacion, ',', 2));
    ELSE
      ciudad_extraida := trim(prop.ubicacion);
      distrito_extraido := NULL;
    END IF;
    
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
      prop.id,
      prop.external_id,
      prop.portal_origen,
      prop.precio,
      prop.precio_m2,
      prop.metros,
      prop.dormitorios,
      prop.banos,
      prop.tipo_propiedad,
      prop.ubicacion,
      ciudad_extraida,
      distrito_extraido,
      prop.condition,
      prop.ano_construccion,
      prop.tiene_ascensor,
      prop.tiene_parking,
      COALESCE(prop.fecha_scraping, prop.created_at),
      'desactivado'
    );
    
    archivadas := archivadas + 1;
  END LOOP;
  
  RETURN archivadas;
END;
$$;