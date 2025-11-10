-- Tabla para feedback de matchings (ML training data)
CREATE TABLE public.matching_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matching_id UUID REFERENCES public.matchings(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL,
  propiedad_id UUID NOT NULL,
  feedback_type TEXT NOT NULL CHECK (feedback_type IN ('muy_relevante', 'relevante', 'neutral', 'irrelevante', 'muy_irrelevante')),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para mejorar performance de queries ML
CREATE INDEX idx_matching_feedback_cliente ON public.matching_feedback(cliente_id);
CREATE INDEX idx_matching_feedback_propiedad ON public.matching_feedback(propiedad_id);
CREATE INDEX idx_matching_feedback_type ON public.matching_feedback(feedback_type);
CREATE INDEX idx_matching_feedback_created ON public.matching_feedback(created_at DESC);

-- RLS policies
ALTER TABLE public.matching_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Los usuarios pueden ver su propio feedback"
ON public.matching_feedback FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = matching_feedback.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden crear su propio feedback"
ON public.matching_feedback FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = matching_feedback.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

CREATE POLICY "Los usuarios pueden actualizar su propio feedback"
ON public.matching_feedback FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.clientes
    WHERE clientes.id = matching_feedback.cliente_id
    AND clientes.user_id = auth.uid()
  )
);

-- Service role puede gestionar todo para ML processing
CREATE POLICY "Service role puede gestionar feedback"
ON public.matching_feedback FOR ALL
USING (true)
WITH CHECK (true);