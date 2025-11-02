-- Tabla para almacenar configuración de ubicaciones
CREATE TABLE IF NOT EXISTS public.ubicaciones_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contenido JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- RLS: Solo admins pueden gestionar ubicaciones
ALTER TABLE public.ubicaciones_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins pueden gestionar ubicaciones"
ON public.ubicaciones_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insertar configuración inicial si no existe
INSERT INTO public.ubicaciones_config (contenido)
SELECT '{
  "Madrid": {
    "provincia": "Madrid",
    "ciudades": {
      "Madrid": ["Centro", "Norte", "Sur", "Este", "Oeste", "Salamanca-Retiro", "Chamberí-Tetuán"],
      "Alcalá de Henares": [],
      "Alcobendas": [],
      "Alcorcón": []
    }
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.ubicaciones_config);