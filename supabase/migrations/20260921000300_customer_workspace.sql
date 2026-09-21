BEGIN;
CREATE TABLE public.property_decisions(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
 stage text NOT NULL DEFAULT 'review' CHECK(stage IN ('new','saved','review','contact','visit','discarded','closed')),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=10000),reason text NOT NULL DEFAULT '' CHECK(length(reason)<=1000),
 visit_at timestamptz,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,propiedad_id)
);
CREATE TABLE public.investment_scenarios(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 propiedad_id uuid REFERENCES public.propiedades(id) ON DELETE SET NULL,name text NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 inputs jsonb NOT NULL CHECK(jsonb_typeof(inputs)='object' AND length(inputs::text)<=20000),
 version integer NOT NULL DEFAULT 1,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.scenario_versions(
 scenario_id uuid NOT NULL REFERENCES public.investment_scenarios(id) ON DELETE CASCADE,version integer NOT NULL,
 inputs jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(scenario_id,version)
);
CREATE TABLE public.notification_preferences(
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,enabled boolean NOT NULL DEFAULT true,
 email_enabled boolean NOT NULL DEFAULT false,frequency text NOT NULL DEFAULT 'daily' CHECK(frequency IN ('daily','instant','none')),
 timezone text NOT NULL DEFAULT 'Europe/Madrid',quiet_start smallint NOT NULL DEFAULT 22 CHECK(quiet_start BETWEEN 0 AND 23),
 quiet_end smallint NOT NULL DEFAULT 8 CHECK(quiet_end BETWEEN 0 AND 23),paused_until timestamptz,updated_at timestamptz DEFAULT now()
);
CREATE TABLE public.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 propiedad_id uuid REFERENCES public.propiedades(id) ON DELETE CASCADE,event_kind text NOT NULL,event_version bigint NOT NULL,
 title text NOT NULL,details jsonb NOT NULL DEFAULT '{}',read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id,propiedad_id,event_kind,event_version)
);
CREATE TABLE public.notification_deliveries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 notification_ids uuid[] NOT NULL,payload jsonb NOT NULL,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','accepted','delivered','failed','uncertain','suppressed')),
 attempts integer NOT NULL DEFAULT 0,provider_id text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.notification_email_queue(notification_id uuid PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,delivery_id uuid REFERENCES public.notification_deliveries(id) ON DELETE CASCADE);
CREATE TABLE public.shared_selections(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 token_hash text UNIQUE NOT NULL,payload jsonb NOT NULL,expires_at timestamptz NOT NULL,revoked boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.usage_budgets(
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,day date NOT NULL,kind text NOT NULL,
 limit_units bigint NOT NULL CHECK(limit_units>=0),reserved_units bigint NOT NULL DEFAULT 0 CHECK(reserved_units>=0),spent_units bigint NOT NULL DEFAULT 0 CHECK(spent_units>=0),
 PRIMARY KEY(user_id,day,kind),CHECK(reserved_units+spent_units<=limit_units)
);
CREATE TABLE public.usage_reservations(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 request_key text NOT NULL CHECK(length(request_key) BETWEEN 1 AND 128),day date NOT NULL,kind text NOT NULL,units bigint NOT NULL CHECK(units>0),
 status text NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','charged','uncertain','released')),actual_units bigint,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,request_key),FOREIGN KEY(user_id,day,kind) REFERENCES public.usage_budgets(user_id,day,kind)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['property_decisions','investment_scenarios','notification_preferences','shared_selections'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
   EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
   EXECUTE format('CREATE POLICY owner_access ON public.%I FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid())',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['scenario_versions','notifications','notification_deliveries','notification_email_queue','usage_budgets','usage_reservations'] LOOP
   EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t);
 END LOOP;
END $$;
-- Shares can only be created with the safe projection in create_shared_selection.
REVOKE INSERT,UPDATE ON public.shared_selections FROM authenticated;
GRANT UPDATE(revoked) ON public.shared_selections TO authenticated;
GRANT SELECT ON public.scenario_versions,public.notifications,public.usage_budgets TO authenticated;
GRANT UPDATE(read_at) ON public.notifications TO authenticated;
CREATE POLICY scenario_version_owner ON public.scenario_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.investment_scenarios s WHERE s.id=scenario_id AND s.user_id=auth.uid()));
CREATE POLICY notification_owner ON public.notifications FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE POLICY budget_owner ON public.usage_budgets FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE TRIGGER decision_updated BEFORE UPDATE ON public.property_decisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.version_scenario() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.id<>OLD.id OR NEW.user_id<>OLD.user_id) THEN RAISE EXCEPTION 'Immutable scenario owner'; END IF;
 NEW.version:=CASE WHEN TG_OP='INSERT' THEN 1 ELSE OLD.version+1 END;NEW.updated_at:=now();RETURN NEW;
END $$;
CREATE TRIGGER scenario_version BEFORE INSERT OR UPDATE ON public.investment_scenarios FOR EACH ROW EXECUTE FUNCTION public.version_scenario();
CREATE OR REPLACE FUNCTION public.record_scenario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO public.scenario_versions(scenario_id,version,inputs) VALUES(NEW.id,NEW.version,NEW.inputs);RETURN NULL;END $$;
CREATE TRIGGER scenario_record AFTER INSERT OR UPDATE ON public.investment_scenarios FOR EACH ROW EXECUTE FUNCTION public.record_scenario();
CREATE OR REPLACE FUNCTION public.check_notification_timezone() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=NEW.timezone) THEN RAISE EXCEPTION 'Invalid timezone'; END IF;
 NEW.updated_at:=now();RETURN NEW;
END $$;
CREATE TRIGGER notification_timezone BEFORE INSERT OR UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.check_notification_timezone();

CREATE OR REPLACE FUNCTION public.notify_matching() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid;p public.propiedades%ROWTYPE;pref public.notification_preferences%ROWTYPE;n uuid;ev record;
BEGIN
 IF NEW.score<60 THEN RETURN NULL; END IF;
 SELECT user_id INTO uid FROM public.clientes WHERE id=NEW.cliente_id;
 IF uid IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO pref FROM public.notification_preferences WHERE user_id=uid;
 IF pref.enabled=false OR pref.frequency='none' OR pref.paused_until>now() THEN RETURN NULL; END IF;
 SELECT * INTO p FROM public.propiedades WHERE id=NEW.propiedad_id;
 IF NOT p.activo OR p.last_seen<now()-interval '7 days' THEN RETURN NULL; END IF;
 INSERT INTO public.notifications(user_id,propiedad_id,event_kind,event_version,title,details)
 VALUES(uid,p.id,'new_candidate',0,'Nuevo candidato para tu búsqueda',jsonb_build_object('titulo',p.titulo,'precio',p.precio,'source',p.portal_origen,'observed_at',p.last_seen))
 ON CONFLICT DO NOTHING RETURNING id INTO n;
 IF n IS NOT NULL AND pref.email_enabled=true THEN INSERT INTO public.notification_email_queue(notification_id) VALUES(n) ON CONFLICT DO NOTHING; END IF;
 FOR ev IN SELECT * FROM public.property_events WHERE propiedad_id=p.id AND version=NEW.property_version AND kind IN ('price_drop','reappeared') LOOP
   n:=NULL;
   INSERT INTO public.notifications(user_id,propiedad_id,event_kind,event_version,title,details)
   VALUES(uid,p.id,ev.kind,ev.version,CASE WHEN ev.kind='price_drop' THEN 'Bajada de precio' ELSE 'Anuncio observado de nuevo' END,ev.value||jsonb_build_object('titulo',p.titulo,'previous',ev.previous_value))
   ON CONFLICT DO NOTHING RETURNING id INTO n;
   IF n IS NOT NULL AND pref.email_enabled=true THEN INSERT INTO public.notification_email_queue(notification_id) VALUES(n) ON CONFLICT DO NOTHING; END IF;
 END LOOP;
 RETURN NULL;
END $$;
CREATE TRIGGER matching_notification AFTER INSERT OR UPDATE ON public.matchings FOR EACH ROW EXECUTE FUNCTION public.notify_matching();

CREATE OR REPLACE FUNCTION public.reserve_usage(p_user uuid,p_key text,p_kind text,p_units bigint) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.usage_reservations%ROWTYPE;d date:=(now() AT TIME ZONE 'UTC')::date;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_user::text,2));
 SELECT * INTO r FROM public.usage_reservations WHERE user_id=p_user AND request_key=p_key;
 IF FOUND THEN
   IF r.units<>p_units OR r.kind<>p_kind THEN RAISE EXCEPTION 'Reservation conflict'; END IF;RETURN r.id;
 END IF;
 IF p_units<=0 THEN RAISE EXCEPTION 'Invalid units'; END IF;
 UPDATE public.usage_budgets SET reserved_units=reserved_units+p_units WHERE user_id=p_user AND day=d AND kind=p_kind AND reserved_units+spent_units+p_units<=limit_units;
 IF NOT FOUND THEN RAISE EXCEPTION 'Usage limit reached' USING ERRCODE='54000'; END IF;
 INSERT INTO public.usage_reservations(user_id,request_key,day,kind,units) VALUES(p_user,p_key,d,p_kind,p_units) RETURNING id INTO r.id;RETURN r.id;
END $$;
CREATE OR REPLACE FUNCTION public.settle_usage(p_id uuid,p_status text,p_actual bigint DEFAULT 0) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.usage_reservations%ROWTYPE;
BEGIN
 SELECT * INTO r FROM public.usage_reservations WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR (p_status='released' AND p_actual<>0) OR p_status NOT IN ('charged','released','uncertain') OR p_actual<0 OR p_actual>r.units THEN RAISE EXCEPTION 'Invalid settlement'; END IF;
 IF r.status IN ('charged','released') THEN
   IF r.status<>p_status OR r.actual_units<>p_actual THEN RAISE EXCEPTION 'Settlement conflict'; END IF;RETURN;
 END IF;
 IF p_status='uncertain' THEN UPDATE public.usage_reservations SET status='uncertain' WHERE id=p_id;RETURN;END IF;
 UPDATE public.usage_budgets SET reserved_units=reserved_units-r.units,spent_units=spent_units+CASE WHEN p_status='charged' THEN p_actual ELSE 0 END WHERE user_id=r.user_id AND day=r.day AND kind=r.kind;
 UPDATE public.usage_reservations SET status=p_status,actual_units=p_actual WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_usage(uuid,text,text,bigint),public.settle_usage(uuid,text,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_usage(uuid,text,text,bigint),public.settle_usage(uuid,text,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.create_shared_selection(p_ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE token text:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');items jsonb;sid uuid;
BEGIN
 IF auth.uid() IS NULL OR cardinality(p_ids) NOT BETWEEN 2 AND 4 THEN RAISE EXCEPTION 'Select 2 to 4 listings';END IF;
 SELECT jsonb_agg(jsonb_build_object('id',p.id,'titulo',p.titulo,'precio',p.precio,'metros',p.metros,'dormitorios',p.dormitorios,'banos',p.banos,'ubicacion',p.ubicacion,'url',p.url,'last_seen',p.last_seen))
 INTO items FROM public.propiedades p WHERE p.id=ANY(p_ids) AND p.activo AND EXISTS(SELECT 1 FROM public.matchings m JOIN public.clientes c ON c.id=m.cliente_id WHERE m.propiedad_id=p.id AND c.user_id=auth.uid());
 IF jsonb_array_length(items) IS DISTINCT FROM cardinality(p_ids) THEN RAISE EXCEPTION 'Listing unavailable'; END IF;
 IF (SELECT count(*) FROM public.shared_selections WHERE user_id=auth.uid() AND NOT revoked AND expires_at>now())>=20 THEN RAISE EXCEPTION 'Share limit reached';END IF;
 INSERT INTO public.shared_selections(user_id,token_hash,payload,expires_at) VALUES(auth.uid(),md5(token),items,now()+interval '7 days') RETURNING id INTO sid;
 RETURN jsonb_build_object('id',sid,'token',token,'expires_at',now()+interval '7 days');
END $$;
CREATE OR REPLACE FUNCTION public.read_shared_selection(p_token text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT jsonb_build_object('items',payload,'created_at',created_at,'expires_at',expires_at) FROM public.shared_selections
 WHERE length(p_token)=64 AND token_hash=md5(p_token) AND NOT revoked AND expires_at>now();
$$;
REVOKE ALL ON FUNCTION public.create_shared_selection(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_shared_selection(uuid[]) TO authenticated;
REVOKE ALL ON FUNCTION public.read_shared_selection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.read_shared_selection(text) TO anon,authenticated;

CREATE OR REPLACE FUNCTION public.export_my_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid();result jsonb;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';END IF;
 SELECT jsonb_build_object('exported_at',now(),'format_version',1,
 'profiles',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]') FROM public.clientes c WHERE user_id=uid),
 'searches',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM public.search_versions s JOIN public.clientes c ON c.id=s.cliente_id WHERE c.user_id=uid),
 'decisions',(SELECT coalesce(jsonb_agg(to_jsonb(d)),'[]') FROM public.property_decisions d WHERE user_id=uid),
 'scenarios',(SELECT coalesce(jsonb_agg(to_jsonb(s)),'[]') FROM public.investment_scenarios s WHERE user_id=uid),
 'scenario_versions',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]') FROM public.scenario_versions v JOIN public.investment_scenarios s ON s.id=v.scenario_id WHERE s.user_id=uid),
 'notifications',(SELECT coalesce(jsonb_agg(to_jsonb(n)),'[]') FROM public.notifications n WHERE user_id=uid),
 'notification_preferences',(SELECT to_jsonb(p) FROM public.notification_preferences p WHERE user_id=uid),
 'favorites',(SELECT coalesce(jsonb_agg(jsonb_build_object('property_id',m.propiedad_id,'favorite',m.favorito,'seen',m.visto)),'[]') FROM public.matchings m JOIN public.clientes c ON c.id=m.cliente_id WHERE c.user_id=uid),
 'feedback',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]') FROM public.matching_feedback f JOIN public.clientes c ON c.id=f.cliente_id WHERE c.user_id=uid),
 'shares',(SELECT coalesce(jsonb_agg(to_jsonb(s)-'token_hash'),'[]') FROM public.shared_selections s WHERE user_id=uid)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.export_my_workspace() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.export_my_workspace() TO authenticated;
COMMIT;
