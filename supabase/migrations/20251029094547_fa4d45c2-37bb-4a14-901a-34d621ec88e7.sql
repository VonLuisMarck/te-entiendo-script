-- Actualizar tabla clientes con límites de suscripción
ALTER TABLE public.clientes 
ADD COLUMN IF NOT EXISTS limite_matchings_mes integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS matchings_usados_mes integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS fecha_reset_matchings timestamp with time zone DEFAULT date_trunc('month', now() + interval '1 month');

-- Crear tabla para mapear clientes Supabase con customers de Stripe
CREATE TABLE IF NOT EXISTS public.stripe_customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  stripe_subscription_id text,
  subscription_status text,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS en stripe_customers
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver su propia info de Stripe
CREATE POLICY "Users can view their own Stripe info"
ON public.stripe_customers
FOR SELECT
USING (auth.uid() = user_id);

-- Service role puede gestionar stripe_customers
CREATE POLICY "Service role can manage stripe_customers"
ON public.stripe_customers
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para actualizar updated_at en stripe_customers
CREATE TRIGGER update_stripe_customers_updated_at
BEFORE UPDATE ON public.stripe_customers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Función para mapear subscription_tier a límites
CREATE OR REPLACE FUNCTION public.get_matchings_limit(tier subscription_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE tier
    WHEN 'free' THEN 5
    WHEN 'basic' THEN 20
    WHEN 'investor' THEN NULL  -- ilimitado
    WHEN 'investor_platino' THEN NULL  -- ilimitado
    ELSE 5
  END;
$$;

-- Trigger para resetear contador de matchings mensual
CREATE OR REPLACE FUNCTION public.reset_matchings_counter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si pasó el mes, resetear contador
  IF NEW.fecha_reset_matchings <= now() THEN
    NEW.matchings_usados_mes = 0;
    NEW.fecha_reset_matchings = date_trunc('month', now() + interval '1 month');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_matchings_reset
BEFORE UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.reset_matchings_counter();