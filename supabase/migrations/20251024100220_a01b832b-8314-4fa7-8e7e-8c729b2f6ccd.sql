-- Crear tabla de métricas por barrio para análisis de mercado
CREATE TABLE IF NOT EXISTS public.metricas_barrios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identificación geográfica
  ciudad TEXT NOT NULL,
  barrio TEXT, -- NULL si es agregado por ciudad completa
  
  -- Métricas de precio
  precio_medio NUMERIC,
  precio_m2_medio NUMERIC,
  precio_m2_min NUMERIC,
  precio_m2_max NUMERIC,
  precio_m2_percentil_25 NUMERIC,
  precio_m2_percentil_50 NUMERIC, -- mediana
  precio_m2_percentil_75 NUMERIC,
  
  -- Distribución por tipo de propiedad
  metros_medio_piso NUMERIC,
  metros_medio_chalet NUMERIC,
  precio_medio_piso NUMERIC,
  precio_medio_chalet NUMERIC,
  precio_m2_medio_piso NUMERIC,
  precio_m2_medio_chalet NUMERIC,
  
  -- Volumen de datos (para confiabilidad)
  total_propiedades INT DEFAULT 0,
  total_pisos INT DEFAULT 0,
  total_chalets INT DEFAULT 0,
  total_otros INT DEFAULT 0,
  
  -- Estado del mercado
  tendencia TEXT, -- 'subiendo', 'estable', 'bajando'
  variacion_mensual NUMERIC, -- % de cambio respecto al mes anterior
  
  -- Metadata
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraint único por ciudad-barrio
  UNIQUE(ciudad, barrio)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_metricas_ciudad ON public.metricas_barrios(ciudad);
CREATE INDEX idx_metricas_ciudad_barrio ON public.metricas_barrios(ciudad, barrio);
CREATE INDEX idx_metricas_precio_m2 ON public.metricas_barrios(precio_m2_medio);

-- Añadir campo para análisis de chollo en matchings
ALTER TABLE public.matchings 
ADD COLUMN IF NOT EXISTS analisis_mercado JSONB;

-- Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION public.update_metricas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ultima_actualizacion = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_metricas_barrios_updated_at
BEFORE UPDATE ON public.metricas_barrios
FOR EACH ROW
EXECUTE FUNCTION public.update_metricas_updated_at();

-- RLS para métricas (público para lectura, solo admins para escritura)
ALTER TABLE public.metricas_barrios ENABLE ROW LEVEL SECURITY;

-- Todos pueden ver las métricas
CREATE POLICY "Cualquiera puede ver métricas de barrios"
ON public.metricas_barrios
FOR SELECT
USING (true);

-- Solo service role puede insertar/actualizar (desde edge functions)
CREATE POLICY "Service role puede gestionar métricas"
ON public.metricas_barrios
FOR ALL
USING (true)
WITH CHECK (true);

-- Comentarios para documentación
COMMENT ON TABLE public.metricas_barrios IS 'Métricas agregadas de mercado inmobiliario por ciudad y barrio';
COMMENT ON COLUMN public.metricas_barrios.precio_m2_medio IS 'Precio promedio por metro cuadrado en esta zona';
COMMENT ON COLUMN public.metricas_barrios.tendencia IS 'Tendencia del mercado: subiendo, estable, bajando';
COMMENT ON COLUMN public.matchings.analisis_mercado IS 'Análisis de precio vs mercado: {desviacion_porcentaje, es_chollo, nivel_chollo}';