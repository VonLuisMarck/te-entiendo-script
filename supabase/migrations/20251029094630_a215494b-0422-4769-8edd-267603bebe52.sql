-- Actualizar función get_matchings_limit con search_path
CREATE OR REPLACE FUNCTION public.get_matchings_limit(tier subscription_tier)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE tier
    WHEN 'free' THEN 5
    WHEN 'basic' THEN 20
    WHEN 'investor' THEN NULL  -- ilimitado
    WHEN 'investor_platino' THEN NULL  -- ilimitado
    ELSE 5
  END;
$$;