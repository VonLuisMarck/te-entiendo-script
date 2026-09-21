BEGIN;
ALTER TABLE public.criterios_busqueda ADD COLUMN preferences jsonb NOT NULL DEFAULT '{}',ADD COLUMN geography jsonb;
ALTER TABLE public.criterios_busqueda ALTER COLUMN flexibilidad_presupuesto SET DEFAULT 0;
CREATE TABLE public.search_state(
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  version bigint NOT NULL DEFAULT 1,snapshot jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.search_versions(
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,version bigint NOT NULL,
  snapshot jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(cliente_id,version)
);
CREATE TABLE public.matching_queue(
  cliente_id uuid PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  generation bigint NOT NULL DEFAULT 1,requested_at timestamptz NOT NULL DEFAULT now(),reason text NOT NULL
);
ALTER TABLE public.matchings ADD COLUMN search_version bigint,ADD COLUMN property_version bigint,ADD COLUMN ranking_version text;
ALTER TABLE public.search_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matching_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.search_state,public.search_versions,public.matching_queue FROM anon,authenticated;
GRANT SELECT ON public.search_state,public.search_versions TO authenticated;
CREATE POLICY own_search_state ON public.search_state FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=cliente_id AND c.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));
CREATE POLICY own_search_versions ON public.search_versions FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.clientes c WHERE c.id=cliente_id AND c.user_id=auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.queue_matching(p_client uuid,p_reason text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 INSERT INTO public.matching_queue(cliente_id,reason) VALUES(p_client,p_reason) ON CONFLICT(cliente_id)
 DO UPDATE SET generation=matching_queue.generation+1,requested_at=now(),reason=excluded.reason;
$$;
REVOKE ALL ON FUNCTION public.queue_matching(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.queue_matching(uuid,text) TO service_role;
CREATE OR REPLACE FUNCTION public.snapshot_search(p_client uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE snapshot_value jsonb;v bigint;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_client::text,1));
 SELECT jsonb_build_object('presupuesto_min',c.presupuesto_min,'presupuesto_max',c.presupuesto_max,'perfil',c.perfil,
   'criteria',(SELECT to_jsonb(k)-ARRAY['created_at','updated_at'] FROM public.criterios_busqueda k WHERE k.cliente_id=c.id ORDER BY k.updated_at DESC,k.id DESC LIMIT 1))
 INTO snapshot_value FROM public.clientes c WHERE c.id=p_client;
 IF snapshot_value IS NULL THEN RETURN; END IF;
 INSERT INTO public.search_state(cliente_id,snapshot) VALUES(p_client,snapshot_value)
 ON CONFLICT(cliente_id) DO UPDATE SET version=search_state.version+1,snapshot=excluded.snapshot,updated_at=now()
 WHERE search_state.snapshot IS DISTINCT FROM excluded.snapshot RETURNING version INTO v;
 IF v IS NULL THEN RETURN; END IF;
 INSERT INTO public.search_versions(cliente_id,version,snapshot) VALUES(p_client,v,snapshot_value);
 UPDATE public.matchings SET score=0 WHERE cliente_id=p_client;
 PERFORM public.queue_matching(p_client,'search.updated');
END $$;
REVOKE ALL ON FUNCTION public.snapshot_search(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.snapshot_search(uuid) TO service_role;
CREATE OR REPLACE FUNCTION public.invalidate_changed_search() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='criterios_busqueda' THEN
   IF TG_OP<>'INSERT' THEN PERFORM public.snapshot_search(OLD.cliente_id); END IF;
   IF TG_OP<>'DELETE' THEN PERFORM public.snapshot_search(NEW.cliente_id); END IF;
 ELSE PERFORM public.snapshot_search(NEW.id); END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION public.invalidate_changed_property() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c record;
BEGIN
 IF TG_OP='UPDATE' AND NEW.data_version=OLD.data_version AND NEW.last_seen IS NOT DISTINCT FROM OLD.last_seen THEN RETURN NULL; END IF;
 UPDATE public.matchings SET score=0 WHERE propiedad_id=NEW.id AND property_version IS DISTINCT FROM NEW.data_version;
 FOR c IN SELECT id FROM public.clientes WHERE activo AND (
   EXISTS(SELECT 1 FROM public.matchings m WHERE m.cliente_id=clientes.id AND m.propiedad_id=NEW.id) OR
   ((presupuesto_min IS NULL OR presupuesto_min<=NEW.precio) AND (presupuesto_max IS NULL OR presupuesto_max*1.3>=NEW.precio)))
 LOOP PERFORM public.queue_matching(c.id,'listing.observed'); END LOOP;
 RETURN NULL;
END $$;
DROP TRIGGER invalidate_property_matches ON public.propiedades;
CREATE TRIGGER invalidate_property_matches AFTER INSERT OR UPDATE ON public.propiedades FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_property();
SELECT public.snapshot_search(id) FROM public.clientes;

CREATE OR REPLACE FUNCTION public.save_client_search(p_profile jsonb,p_criteria jsonb,p_expected_version bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;current_version bigint;criteria_id uuid;item public.criterios_busqueda%ROWTYPE;profile public.clientes%ROWTYPE;
BEGIN
 cid:=public.ensure_cliente_profile();
 PERFORM pg_advisory_xact_lock(hashtextextended(cid::text,1));
 SELECT version INTO current_version FROM public.search_state WHERE cliente_id=cid FOR UPDATE;
 IF p_expected_version IS NOT NULL AND p_expected_version<>coalesce(current_version,0) THEN RAISE EXCEPTION 'Search changed in another session' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_profile)<>'object' OR jsonb_typeof(p_criteria)<>'object' THEN RAISE EXCEPTION 'Invalid search'; END IF;
 profile:=jsonb_populate_record(NULL::public.clientes,p_profile);
 item:=jsonb_populate_record(NULL::public.criterios_busqueda,p_criteria);
 IF cardinality(item.ubicaciones) NOT BETWEEN 1 AND 10 OR item.ubicaciones IS NULL OR EXISTS(SELECT 1 FROM unnest(item.ubicaciones) u WHERE length(trim(u)) NOT BETWEEN 1 AND 100)
   OR profile.perfil NOT IN ('vivir','alquilar','vender') OR profile.perfil IS NULL THEN RAISE EXCEPTION 'Invalid search criteria'; END IF;
 IF jsonb_typeof(coalesce(item.preferences,'{}'))<>'object' OR length(coalesce(item.preferences,'{}')::text)>4096 OR length(coalesce(item.geography,'{}')::text)>10000 THEN RAISE EXCEPTION 'Invalid preferences'; END IF;
 IF item.geography IS NOT NULL THEN
   IF item.geography->>'kind'='radius' THEN
     IF jsonb_typeof(item.geography->'center') IS DISTINCT FROM 'array' OR jsonb_array_length(item.geography->'center')<>2
       OR jsonb_typeof(item.geography#>'{center,0}') IS DISTINCT FROM 'number' OR jsonb_typeof(item.geography#>'{center,1}') IS DISTINCT FROM 'number'
       OR abs((item.geography#>>'{center,0}')::numeric)>180 OR abs((item.geography#>>'{center,1}')::numeric)>90
       OR jsonb_typeof(item.geography->'km') IS DISTINCT FROM 'number' OR (item.geography->>'km')::numeric NOT BETWEEN 0.1 AND 200 THEN RAISE EXCEPTION 'Invalid geography';END IF;
   ELSIF item.geography->>'kind'='polygon' THEN
     IF jsonb_typeof(item.geography->'points') IS DISTINCT FROM 'array' OR jsonb_array_length(item.geography->'points') NOT BETWEEN 3 AND 100 THEN RAISE EXCEPTION 'Invalid geography';END IF;
     IF EXISTS(SELECT 1 FROM jsonb_array_elements(item.geography->'points') vertex WHERE jsonb_typeof(vertex)<>'array' OR jsonb_array_length(vertex)<>2 OR jsonb_typeof(vertex->0)<>'number' OR jsonb_typeof(vertex->1)<>'number' OR abs((vertex->>0)::numeric)>180 OR abs((vertex->>1)::numeric)>90) THEN RAISE EXCEPTION 'Invalid geography';END IF;
   ELSE RAISE EXCEPTION 'Invalid geography';END IF;
 END IF;
 -- Explicit field allowlists: client-supplied entitlement/owner/version fields are ignored.
 UPDATE public.clientes SET presupuesto_min=profile.presupuesto_min,presupuesto_max=profile.presupuesto_max,
   telefono=left(profile.telefono,30),perfil=profile.perfil WHERE id=cid;
 SELECT id INTO criteria_id FROM public.criterios_busqueda WHERE cliente_id=cid ORDER BY updated_at DESC,id DESC LIMIT 1 FOR UPDATE;
 IF criteria_id IS NULL THEN INSERT INTO public.criterios_busqueda(cliente_id,ubicaciones) VALUES(cid,item.ubicaciones) RETURNING id INTO criteria_id; END IF;
 UPDATE public.criterios_busqueda SET ubicaciones=item.ubicaciones,tipo_propiedad=item.tipo_propiedad,dormitorios_min=item.dormitorios_min,
   banos_min=item.banos_min,metros_min=item.metros_min,metros_max=item.metros_max,precio_m2_max=item.precio_m2_max,condition=item.condition,
   ano_construccion_min=item.ano_construccion_min,tiene_ascensor=item.tiene_ascensor,tiene_parking=item.tiene_parking,
   flexibilidad_presupuesto=coalesce(item.flexibilidad_presupuesto,0),preferences=coalesce(item.preferences,'{}'),geography=item.geography WHERE id=criteria_id;
 RETURN (SELECT jsonb_build_object('id',criteria_id,'cliente_id',cid,'version',version) FROM public.search_state WHERE cliente_id=cid);
END $$;
REVOKE ALL ON FUNCTION public.save_client_search(jsonb,jsonb,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_client_search(jsonb,jsonb,bigint) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_matching(p_client uuid,p_search_version bigint,p_generation bigint,p_matches jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE version_now bigint;generation_now bigint;r jsonb;property_now bigint;
BEGIN
 IF jsonb_typeof(p_matches)<>'array' OR jsonb_array_length(p_matches)>5000 THEN RAISE EXCEPTION 'Matching limit exceeded'; END IF;
 SELECT version INTO version_now FROM public.search_state WHERE cliente_id=p_client FOR UPDATE;
 SELECT generation INTO generation_now FROM public.matching_queue WHERE cliente_id=p_client FOR UPDATE;
 IF version_now IS DISTINCT FROM p_search_version OR generation_now IS DISTINCT FROM p_generation THEN RAISE EXCEPTION 'Matching snapshot changed' USING ERRCODE='40001'; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_matches) LOOP
   SELECT data_version INTO property_now FROM public.propiedades WHERE id=(r->>'propiedad_id')::uuid FOR SHARE;
   IF property_now IS DISTINCT FROM (r->>'property_version')::bigint THEN RAISE EXCEPTION 'Property snapshot changed' USING ERRCODE='40001'; END IF;
   IF (r->>'score')::numeric NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Invalid score'; END IF;
 END LOOP;
 UPDATE public.matchings SET score=0,search_version=p_search_version WHERE cliente_id=p_client;
 INSERT INTO public.matchings(cliente_id,propiedad_id,score,criterios_cumplidos,search_version,property_version,ranking_version)
 SELECT p_client,(item->>'propiedad_id')::uuid,(item->>'score')::numeric,item->'criterios_cumplidos',p_search_version,(item->>'property_version')::bigint,'preferences-v2'
 FROM jsonb_array_elements(p_matches) item
 ON CONFLICT(cliente_id,propiedad_id) DO UPDATE SET score=excluded.score,criterios_cumplidos=excluded.criterios_cumplidos,
   search_version=excluded.search_version,property_version=excluded.property_version,ranking_version=excluded.ranking_version;
 DELETE FROM public.matching_queue WHERE cliente_id=p_client AND generation=p_generation;
 RETURN jsonb_array_length(p_matches);
END $$;
REVOKE ALL ON FUNCTION public.publish_matching(uuid,bigint,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.publish_matching(uuid,bigint,bigint,jsonb) TO service_role;
CREATE INDEX property_active_price ON public.propiedades(precio,id) WHERE activo;
COMMIT;
