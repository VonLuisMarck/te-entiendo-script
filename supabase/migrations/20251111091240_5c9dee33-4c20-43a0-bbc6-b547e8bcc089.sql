-- Habilitar RLS en tabla de logs de alertas
ALTER TABLE public.whatsapp_alerts_log ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver logs de alertas
CREATE POLICY "Solo admins pueden ver logs alertas"
  ON public.whatsapp_alerts_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Service role puede insertar logs
CREATE POLICY "Service role puede insertar logs alertas"
  ON public.whatsapp_alerts_log FOR INSERT
  WITH CHECK (true);