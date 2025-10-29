-- Crear tabla para registrar las llamadas con IA
CREATE TABLE IF NOT EXISTS public.llamadas_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES public.propiedades(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'completada', 'fallida', 'cancelada')),
  fecha_programada TIMESTAMP WITH TIME ZONE,
  fecha_realizada TIMESTAMP WITH TIME ZONE,
  duracion_segundos INTEGER,
  transcripcion TEXT,
  resultado JSONB, -- Datos estructurados capturados: interés, disponibilidad, etc.
  telefono TEXT NOT NULL,
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para las visitas agendadas resultantes de las llamadas
CREATE TABLE IF NOT EXISTS public.visitas_agendadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  llamada_id UUID REFERENCES public.llamadas_ia(id) ON DELETE SET NULL,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  propiedad_id UUID NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  fecha_visita DATE NOT NULL,
  hora_visita TIME NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'confirmada', 'completada', 'cancelada')),
  contacto_portal TEXT, -- Email o contacto del portal para agendar
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_llamadas_ia_cliente ON public.llamadas_ia(cliente_id);
CREATE INDEX idx_llamadas_ia_propiedad ON public.llamadas_ia(propiedad_id);
CREATE INDEX idx_llamadas_ia_estado ON public.llamadas_ia(estado);
CREATE INDEX idx_llamadas_ia_fecha_programada ON public.llamadas_ia(fecha_programada);
CREATE INDEX idx_visitas_agendadas_cliente ON public.visitas_agendadas(cliente_id);
CREATE INDEX idx_visitas_agendadas_propiedad ON public.visitas_agendadas(propiedad_id);
CREATE INDEX idx_visitas_agendadas_fecha ON public.visitas_agendadas(fecha_visita);
CREATE INDEX idx_visitas_agendadas_estado ON public.visitas_agendadas(estado);

-- Habilitar RLS
ALTER TABLE public.llamadas_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitas_agendadas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para llamadas_ia (admin puede ver todo)
CREATE POLICY "Admin puede ver todas las llamadas"
ON public.llamadas_ia FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin puede crear llamadas"
ON public.llamadas_ia FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin puede actualizar llamadas"
ON public.llamadas_ia FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Políticas RLS para visitas_agendadas
CREATE POLICY "Admin puede ver todas las visitas"
ON public.visitas_agendadas FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin puede crear visitas"
ON public.visitas_agendadas FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin puede actualizar visitas"
ON public.visitas_agendadas FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admin puede eliminar visitas"
ON public.visitas_agendadas FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Trigger para actualizar updated_at en llamadas_ia
CREATE TRIGGER update_llamadas_ia_updated_at
BEFORE UPDATE ON public.llamadas_ia
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para actualizar updated_at en visitas_agendadas
CREATE TRIGGER update_visitas_agendadas_updated_at
BEFORE UPDATE ON public.visitas_agendadas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();