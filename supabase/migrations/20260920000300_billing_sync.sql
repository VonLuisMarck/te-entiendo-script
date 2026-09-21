BEGIN;
CREATE OR REPLACE FUNCTION public.sync_customer_subscription(
  p_customer_id text,p_subscription_id text,p_status text,p_tier text,p_period_end timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;
BEGIN
  IF p_tier NOT IN ('free','basic','investor','investor_platino') THEN RAISE EXCEPTION 'Invalid tier'; END IF;
  SELECT user_id INTO uid FROM public.stripe_customers WHERE stripe_customer_id=p_customer_id FOR UPDATE;
  IF uid IS NULL THEN RAISE EXCEPTION 'Customer mapping missing'; END IF;
  IF p_status <> 'active' OR p_period_end IS NULL OR p_period_end <= now() THEN p_tier := 'free'; END IF;
  UPDATE public.stripe_customers SET stripe_subscription_id=p_subscription_id,subscription_status=p_status,
    current_period_end=p_period_end WHERE stripe_customer_id=p_customer_id;
  UPDATE public.clientes SET tipo_suscripcion=p_tier::public.subscription_tier,
    limite_matchings_mes=public.get_matchings_limit(p_tier::public.subscription_tier)
    WHERE user_id=uid;
END $$;
REVOKE ALL ON FUNCTION public.sync_customer_subscription(text,text,text,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.sync_customer_subscription(text,text,text,text,timestamptz) TO service_role;

-- Expired billing rows cannot keep investor access if a webhook is delayed.
CREATE POLICY current_investor_subscription ON public.metricas_inversores AS RESTRICTIVE
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'admin') OR EXISTS (
  SELECT 1 FROM public.stripe_customers s WHERE s.user_id=auth.uid()
    AND s.subscription_status='active' AND s.current_period_end>now()
));
COMMIT;
