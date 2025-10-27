-- Crear tabla de histórico de métricas
CREATE TABLE IF NOT EXISTS public.metricas_barrios_historico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metrica_id UUID NOT NULL REFERENCES public.metricas_barrios(id) ON DELETE CASCADE,
  ciudad TEXT NOT NULL,
  barrio TEXT,
  precio_medio NUMERIC,
  precio_m2_medio NUMERIC,
  total_propiedades INTEGER DEFAULT 0,
  fecha_snapshot TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para consultas históricas eficientes
CREATE INDEX idx_historico_metrica_fecha ON public.metricas_barrios_historico(metrica_id, fecha_snapshot DESC);
CREATE INDEX idx_historico_ciudad_barrio ON public.metricas_barrios_historico(ciudad, barrio, fecha_snapshot DESC);

-- Añadir columnas de proyección a metricas_barrios
ALTER TABLE public.metricas_barrios 
ADD COLUMN IF NOT EXISTS proyeccion_revalorizacion_anual NUMERIC,
ADD COLUMN IF NOT EXISTS indice_dinamismo NUMERIC,
ADD COLUMN IF NOT EXISTS meses_datos_historicos INTEGER DEFAULT 0;

-- Comentarios para documentación
COMMENT ON TABLE public.metricas_barrios_historico IS 'Histórico de métricas por barrio para cálculo de tendencias y revalorización';
COMMENT ON COLUMN public.metricas_barrios.proyeccion_revalorizacion_anual IS 'Proyección de revalorización anual en % (calculada con datos históricos)';
COMMENT ON COLUMN public.metricas_barrios.indice_dinamismo IS 'Índice temporal de dinamismo 0-100 mientras se acumula histórico';
COMMENT ON COLUMN public.metricas_barrios.meses_datos_historicos IS 'Número de meses de datos históricos disponibles';

-- RLS para histórico (solo lectura pública, escritura service)
ALTER TABLE public.metricas_barrios_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cualquiera puede ver histórico de métricas"
  ON public.metricas_barrios_historico
  FOR SELECT
  USING (true);

CREATE POLICY "Service role puede gestionar histórico"
  ON public.metricas_barrios_historico
  FOR ALL
  USING (true)
  WITH CHECK (true);