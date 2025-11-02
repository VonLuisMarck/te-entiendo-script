-- Crear tabla para configurar triggers de scraping automático
CREATE TABLE public.scraping_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  portal TEXT NOT NULL,
  ubicacion TEXT,
  max_pages INTEGER,
  scraping_mode TEXT NOT NULL DEFAULT 'single', -- 'single' o 'all'
  cron_expression TEXT NOT NULL, -- Expresión cron (e.g., '0 2 * * *' para diario a las 2am)
  activo BOOLEAN DEFAULT true,
  ultima_ejecucion TIMESTAMP WITH TIME ZONE,
  proxima_ejecucion TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índice para búsquedas rápidas
CREATE INDEX idx_scraping_triggers_activo ON public.scraping_triggers(activo);

-- RLS: Solo admins pueden gestionar triggers
ALTER TABLE public.scraping_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden gestionar triggers"
ON public.scraping_triggers
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger para actualizar updated_at
CREATE TRIGGER update_scraping_triggers_updated_at
BEFORE UPDATE ON public.scraping_triggers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();