BEGIN;
-- No automatic deletion of listings: preserve decisions, history and identity links.
CREATE OR REPLACE FUNCTION public.archivar_propiedades_inactivas() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 UPDATE public.propiedades SET availability='not_seen_recently' WHERE NOT activo AND availability NOT IN ('removed_confirmed','not_seen_recently');GET DIAGNOSTICS n=ROW_COUNT;RETURN n;
END $$;
CREATE OR REPLACE FUNCTION public.desactivar_propiedades_no_vistas(p_dias_limite integer DEFAULT 7,p_portal text DEFAULT NULL,p_ubicacion text DEFAULT NULL)
RETURNS TABLE(propiedades_desactivadas integer,propiedades_archivadas integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF p_dias_limite<1 OR p_dias_limite>365 THEN RAISE EXCEPTION 'Invalid stale interval';END IF;
 UPDATE public.propiedades SET availability='not_seen_recently' WHERE last_seen<now()-make_interval(days=>p_dias_limite)
 AND availability NOT IN ('removed_confirmed','not_seen_recently') AND (p_portal IS NULL OR portal_origen=p_portal) AND (p_ubicacion IS NULL OR ubicacion=p_ubicacion);
 GET DIAGNOSTICS n=ROW_COUNT;RETURN QUERY SELECT n,0;
END $$;
-- The old service-only privileges on both functions remain in place.
CREATE TABLE public.operating_cost_entries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),period_start date NOT NULL,period_end date NOT NULL,
 category text NOT NULL CHECK(category IN ('infrastructure','browser','database','email','ai','support','other')),
 amount_eur numeric(12,4) NOT NULL CHECK(amount_eur>=0),basis text NOT NULL CHECK(basis IN ('invoice','measured','estimate')),
 reference text NOT NULL CHECK(length(reference) BETWEEN 1 AND 500),created_at timestamptz NOT NULL DEFAULT now(),CHECK(period_end>=period_start)
);
ALTER TABLE public.operating_cost_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.operating_cost_entries FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.operating_cost_entries TO authenticated;
CREATE POLICY operator_costs ON public.operating_cost_entries FOR ALL TO authenticated USING(public.has_role(auth.uid(),'admin')) WITH CHECK(public.has_role(auth.uid(),'admin'));
CREATE OR REPLACE FUNCTION public.operating_metrics() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.role()<>'service_role' AND NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operator required' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('measured_at',now(),
 'matching_queue',(SELECT count(*) FROM public.matching_queue),
 'oldest_matching_request',(SELECT min(requested_at) FROM public.matching_queue),
 'raw_pending',(SELECT count(*) FROM public.propiedades_raw WHERE NOT procesado AND intentos_procesamiento<3),
 'raw_review',(SELECT count(*) FROM public.propiedades_raw WHERE NOT procesado AND intentos_procesamiento>=3),
 'email_outcomes',(SELECT coalesce(jsonb_object_agg(status,n),'{}') FROM (SELECT status,count(*) n FROM public.notification_deliveries GROUP BY status) s),
 'weekly_relevant_opportunities',(SELECT count(*) FROM (SELECT DISTINCT ON(cliente_id,propiedad_id) feedback_type FROM public.matching_feedback WHERE created_at>=now()-interval '7 days' ORDER BY cliente_id,propiedad_id,created_at DESC,id DESC) latest WHERE feedback_type IN ('relevante','muy_relevante')),
 'active_searches',(SELECT count(*) FROM public.search_state s JOIN public.clientes c ON c.id=s.cliente_id WHERE c.activo),
 'weekly_observed_listings',(SELECT count(*) FROM public.propiedades WHERE last_seen>=now()-interval '7 days'),
 'cost_entries',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM (SELECT * FROM public.operating_cost_entries ORDER BY period_end DESC LIMIT 100) c));
END $$;
REVOKE ALL ON FUNCTION public.operating_metrics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.operating_metrics() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.prune_private_retention() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE raw_count integer;delivery_count integer;share_count integer;
BEGIN
 -- Keep unresolved/uncertain deliveries until an operator has reconciled them.
 DELETE FROM public.propiedades_raw WHERE procesado AND updated_at<now()-interval '30 days';GET DIAGNOSTICS raw_count=ROW_COUNT;
 DELETE FROM public.notification_deliveries WHERE status IN ('accepted','delivered','suppressed','failed') AND updated_at<now()-interval '30 days';GET DIAGNOSTICS delivery_count=ROW_COUNT;
 DELETE FROM public.shared_selections WHERE expires_at<now()-interval '7 days';GET DIAGNOSTICS share_count=ROW_COUNT;
 RETURN jsonb_build_object('processed_raw',raw_count,'terminal_emails',delivery_count,'expired_shares',share_count);
END $$;
REVOKE ALL ON FUNCTION public.prune_private_retention() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prune_private_retention() TO service_role;
COMMIT;
