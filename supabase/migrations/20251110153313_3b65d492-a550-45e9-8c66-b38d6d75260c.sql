-- Tabla para almacenar propiedades sin procesar (raw)
CREATE TABLE IF NOT EXISTS public.propiedades_raw (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT NOT NULL,
  portal_origen TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  url TEXT NOT NULL,
  procesado BOOLEAN DEFAULT false,
  error_procesamiento TEXT,
  intentos_procesamiento INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Evitar duplicados
  UNIQUE(external_id, portal_origen)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_propiedades_raw_procesado ON public.propiedades_raw(procesado) WHERE procesado = false;
CREATE INDEX IF NOT EXISTS idx_propiedades_raw_portal ON public.propiedades_raw(portal_origen);
CREATE INDEX IF NOT EXISTS idx_propiedades_raw_created ON public.propiedades_raw(created_at DESC);

-- RLS: Service role puede gestionar todo
ALTER TABLE public.propiedades_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role puede gestionar propiedades raw"
  ON public.propiedades_raw
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_propiedades_raw_updated_at
  BEFORE UPDATE ON public.propiedades_raw
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de logs de procesamiento batch
CREATE TABLE IF NOT EXISTS public.batch_processing_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_propiedades INTEGER NOT NULL,
  propiedades_exitosas INTEGER DEFAULT 0,
  propiedades_fallidas INTEGER DEFAULT 0,
  duracion_segundos INTEGER,
  coste_estimado_usd NUMERIC(10,4),
  errores JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para logs
ALTER TABLE public.batch_processing_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver logs de batch"
  ON public.batch_processing_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role puede gestionar logs batch"
  ON public.batch_processing_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);