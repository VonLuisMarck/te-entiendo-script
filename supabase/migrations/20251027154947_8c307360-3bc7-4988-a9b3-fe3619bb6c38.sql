-- Crear tabla para valoraciones de reforma con IA
CREATE TABLE public.valoraciones_reforma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES public.propiedades(id) ON DELETE CASCADE,
  valoracion_ia JSONB NOT NULL,
  coste_min NUMERIC NOT NULL,
  coste_max NUMERIC NOT NULL,
  margen_estudio NUMERIC,
  roi_cliente NUMERIC,
  ofertar BOOLEAN DEFAULT false,
  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente_contacto', 'contactado', 'presupuesto_enviado', 'contratada', 'descartada')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS policies
ALTER TABLE public.valoraciones_reforma ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role puede gestionar valoraciones"
  ON public.valoraciones_reforma
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios pueden ver sus propias valoraciones"
  ON public.valoraciones_reforma
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = valoraciones_reforma.cliente_id
    AND clientes.user_id = auth.uid()
  ));

-- Trigger para updated_at
CREATE TRIGGER update_valoraciones_reforma_updated_at
  BEFORE UPDATE ON public.valoraciones_reforma
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_valoraciones_cliente ON public.valoraciones_reforma(cliente_id);
CREATE INDEX idx_valoraciones_estado ON public.valoraciones_reforma(estado);
CREATE INDEX idx_valoraciones_ofertar ON public.valoraciones_reforma(ofertar) WHERE ofertar = true;