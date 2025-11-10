-- Tabla de configuración de umbrales de costes
CREATE TABLE IF NOT EXISTS public.ai_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  umbral_diario_usd NUMERIC(10,4) DEFAULT 10.0,
  umbral_mensual_usd NUMERIC(10,4) DEFAULT 200.0,
  umbral_por_batch_usd NUMERIC(10,4) DEFAULT 2.0,
  notificar_email BOOLEAN DEFAULT true,
  notificar_ui BOOLEAN DEFAULT true,
  pausar_automatico BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para config
ALTER TABLE public.ai_cost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden gestionar config costes"
  ON public.ai_cost_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insertar configuración por defecto
INSERT INTO public.ai_cost_config (
  umbral_diario_usd,
  umbral_mensual_usd,
  umbral_por_batch_usd,
  notificar_ui,
  pausar_automatico
) VALUES (
  10.0,   -- $10/día
  200.0,  -- $200/mes
  2.0,    -- $2/batch
  true,
  false
) ON CONFLICT DO NOTHING;

-- Tabla de tracking de costes en tiempo real
CREATE TABLE IF NOT EXISTS public.ai_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  coste_acumulado_dia_usd NUMERIC(10,4) DEFAULT 0,
  llamadas_ia_dia INTEGER DEFAULT 0,
  tokens_consumidos_dia BIGINT DEFAULT 0,
  ultimo_batch_coste_usd NUMERIC(10,4),
  ultimo_batch_timestamp TIMESTAMPTZ,
  alerta_activa BOOLEAN DEFAULT false,
  alerta_mensaje TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(fecha)
);

-- Índice para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_ai_cost_tracking_fecha ON public.ai_cost_tracking(fecha DESC);

-- RLS para tracking
ALTER TABLE public.ai_cost_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden ver tracking costes"
  ON public.ai_cost_tracking
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role puede gestionar tracking"
  ON public.ai_cost_tracking
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_ai_cost_config_updated_at
  BEFORE UPDATE ON public.ai_cost_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ai_cost_tracking_updated_at
  BEFORE UPDATE ON public.ai_cost_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Función para obtener coste mensual
CREATE OR REPLACE FUNCTION public.get_coste_mensual_actual()
RETURNS NUMERIC(10,4)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(coste_acumulado_dia_usd), 0)
  FROM ai_cost_tracking
  WHERE fecha >= date_trunc('month', CURRENT_DATE)::DATE;
$$;

-- Habilitar realtime para tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_cost_tracking;