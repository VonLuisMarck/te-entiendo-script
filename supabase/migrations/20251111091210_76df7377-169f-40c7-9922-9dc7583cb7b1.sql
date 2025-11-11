-- Tabla para configuración de administradores y alertas WhatsApp
CREATE TABLE IF NOT EXISTS public.admin_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  telefono TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  recibir_alertas BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.admin_config ENABLE ROW LEVEL SECURITY;

-- Políticas: solo admins pueden gestionar
CREATE POLICY "Solo admins pueden ver admin_config"
  ON public.admin_config FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Solo admins pueden insertar admin_config"
  ON public.admin_config FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Solo admins pueden actualizar admin_config"
  ON public.admin_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_admin_config_updated_at
  BEFORE UPDATE ON public.admin_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla para logs de alertas enviadas (evitar spam)
CREATE TABLE IF NOT EXISTS public.whatsapp_alerts_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_alerta TEXT NOT NULL,
  mensaje TEXT NOT NULL,
  telefono_destino TEXT NOT NULL,
  metadata JSONB,
  enviado_exitosamente BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_whatsapp_alerts_tipo_fecha 
  ON public.whatsapp_alerts_log(tipo_alerta, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_scraping_triggers_ultima_ejecucion 
  ON public.scraping_triggers(ultima_ejecucion DESC);