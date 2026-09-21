BEGIN;
-- Saved recommendations remain readable after the source becomes unavailable.
CREATE POLICY own_saved_listing ON public.propiedades FOR SELECT TO authenticated USING(
 EXISTS(SELECT 1 FROM public.matchings m JOIN public.clientes c ON c.id=m.cliente_id WHERE m.propiedad_id=propiedades.id AND c.user_id=auth.uid()) OR
 EXISTS(SELECT 1 FROM public.property_decisions d WHERE d.propiedad_id=propiedades.id AND d.user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.email_allowed(p_user uuid,p_now timestamptz DEFAULT now()) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((SELECT enabled AND email_enabled AND frequency<>'none' AND (paused_until IS NULL OR paused_until<=p_now) AND
 CASE WHEN quiet_start=quiet_end THEN true WHEN quiet_start<quiet_end THEN
 NOT(extract(hour FROM p_now AT TIME ZONE timezone)>=quiet_start AND extract(hour FROM p_now AT TIME ZONE timezone)<quiet_end)
 ELSE NOT(extract(hour FROM p_now AT TIME ZONE timezone)>=quiet_start OR extract(hour FROM p_now AT TIME ZONE timezone)<quiet_end) END
 FROM public.notification_preferences WHERE user_id=p_user),false);
$$;
CREATE OR REPLACE FUNCTION public.prepare_email_outbox(p_from text,p_app_url text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u record;ids uuid[];body text;did uuid;prepared integer:=0;
BEGIN
 IF length(p_from)>320 OR p_from !~ '@' OR p_app_url !~ '^https://' THEN RAISE EXCEPTION 'Invalid email configuration'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-outbox',0));
 FOR u IN SELECT p.*,a.email FROM public.notification_preferences p JOIN auth.users a ON a.id=p.user_id
 WHERE public.email_allowed(p.user_id) AND EXISTS(SELECT 1 FROM public.notifications n JOIN public.notification_email_queue q ON q.notification_id=n.id WHERE n.user_id=p.user_id AND q.delivery_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM public.notification_deliveries d WHERE d.user_id=p.user_id AND d.created_at>now()-CASE WHEN p.frequency='daily' THEN interval '24 hours' ELSE interval '1 hour' END)
 ORDER BY p.user_id LIMIT 20 LOOP
   SELECT array_agg(id),string_agg(title||': '||coalesce(details->>'titulo','')||E'\n'||coalesce(details->>'precio','')||' EUR',E'\n\n') INTO ids,body
   FROM (SELECT n.* FROM public.notifications n JOIN public.notification_email_queue q ON q.notification_id=n.id WHERE n.user_id=u.user_id AND q.delivery_id IS NULL ORDER BY n.created_at LIMIT 50) selected;
   INSERT INTO public.notification_deliveries(user_id,notification_ids,payload) VALUES(u.user_id,ids,
     jsonb_build_object('from',p_from,'to',jsonb_build_array(u.email),'subject','Findoo · Novedades de tu búsqueda','text',body||E'\n\nVer inmuebles: '||p_app_url||E'/cliente/dashboard\nPausar o desactivar avisos: '||p_app_url||'/cliente/settings')) RETURNING id INTO did;
   UPDATE public.notification_email_queue SET delivery_id=did WHERE notification_id=ANY(ids);
   prepared:=prepared+1;
 END LOOP;RETURN prepared;
END $$;
CREATE OR REPLACE FUNCTION public.claim_email_delivery() RETURNS public.notification_deliveries LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d public.notification_deliveries%ROWTYPE;
BEGIN
 UPDATE public.notification_deliveries SET status='uncertain',updated_at=now() WHERE status='sending' AND updated_at<now()-interval '5 minutes';
 UPDATE public.notification_deliveries pending SET status='suppressed',updated_at=now() WHERE status IN ('pending','uncertain') AND
   (NOT EXISTS(SELECT 1 FROM public.notification_preferences p WHERE p.user_id=pending.user_id AND p.enabled AND p.email_enabled AND p.frequency<>'none') OR
    NOT EXISTS(SELECT 1 FROM auth.users u WHERE u.id=pending.user_id AND u.email=pending.payload#>>'{to,0}'));
 SELECT * INTO d FROM public.notification_deliveries x WHERE status IN ('pending','uncertain') AND attempts<3 AND
   (status='pending' OR (created_at>now()-interval '23 hours' AND updated_at<now()-interval '1 minute')) AND public.email_allowed(x.user_id)
 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1;
 IF d.id IS NULL THEN RETURN NULL;END IF;
 UPDATE public.notification_deliveries SET status='sending',attempts=attempts+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;RETURN d;
END $$;
CREATE OR REPLACE FUNCTION public.finish_email_delivery(p_id uuid,p_attempt integer,p_status text,p_provider_id text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF p_status NOT IN ('accepted','uncertain','failed') OR (p_status='accepted' AND nullif(p_provider_id,'') IS NULL) THEN RAISE EXCEPTION 'Invalid email outcome';END IF;
 UPDATE public.notification_deliveries SET status=p_status,provider_id=p_provider_id,updated_at=now() WHERE id=p_id AND attempts=p_attempt AND status='sending';RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.email_allowed(uuid,timestamptz),public.prepare_email_outbox(text,text),public.claim_email_delivery(),public.finish_email_delivery(uuid,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.email_allowed(uuid,timestamptz),public.prepare_email_outbox(text,text),public.claim_email_delivery(),public.finish_email_delivery(uuid,integer,text,text) TO service_role;
COMMIT;
