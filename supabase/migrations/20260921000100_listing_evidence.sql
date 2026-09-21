BEGIN;
-- Legacy propiedades remains the source listing; canonical identity is separate.
CREATE TABLE public.canonical_properties(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.propiedades ADD COLUMN canonical_id uuid REFERENCES public.canonical_properties(id),
  ADD COLUMN data_version bigint NOT NULL DEFAULT 1,
  ADD COLUMN evidence jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN latitude double precision CHECK(latitude BETWEEN -90 AND 90),
  ADD COLUMN longitude double precision CHECK(longitude BETWEEN -180 AND 180),
  ADD COLUMN location_precision text NOT NULL DEFAULT 'unknown' CHECK(location_precision IN ('exact','approximate','municipality','unknown')),
  ADD COLUMN availability text NOT NULL DEFAULT 'observed' CHECK(availability IN ('observed','needs_verification','not_seen_recently','removed_confirmed','reappeared')),
  ADD COLUMN first_observed_at timestamptz NOT NULL DEFAULT now();
INSERT INTO public.canonical_properties(id) SELECT id FROM public.propiedades;
UPDATE public.propiedades SET canonical_id=id,first_observed_at=coalesce(created_at,now());
ALTER TABLE public.propiedades ALTER COLUMN canonical_id SET NOT NULL;
CREATE TABLE public.listing_observations(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  version bigint NOT NULL,observed_at timestamptz NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),
  facts jsonb NOT NULL,evidence jsonb NOT NULL,UNIQUE(propiedad_id,version)
);
CREATE TABLE public.property_events(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  version bigint NOT NULL,kind text NOT NULL,previous_value jsonb,value jsonb,created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(propiedad_id,version,kind)
);
CREATE TABLE public.identity_audit(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),propiedad_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE CASCADE,
  old_canonical_id uuid REFERENCES public.canonical_properties(id),new_canonical_id uuid NOT NULL REFERENCES public.canonical_properties(id),
  reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),actor uuid REFERENCES auth.users(id) ON DELETE SET NULL,created_at timestamptz DEFAULT now()
);
CREATE TABLE public.ingestion_batches(id text PRIMARY KEY CHECK(id ~ '^[a-f0-9]{64}$'),job_id uuid NOT NULL,
  payload_sha256 text NOT NULL,record_count integer NOT NULL CHECK(record_count BETWEEN 1 AND 50),created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE public.canonical_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.canonical_properties,public.listing_observations,public.property_events,public.identity_audit,public.ingestion_batches FROM anon,authenticated;
GRANT SELECT ON public.canonical_properties,public.listing_observations,public.property_events,public.identity_audit TO authenticated;
CREATE POLICY canonical_read ON public.canonical_properties FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.propiedades p WHERE p.canonical_id=id));
CREATE POLICY observation_read ON public.listing_observations FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.propiedades p WHERE p.id=propiedad_id));
CREATE POLICY event_read ON public.property_events FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.propiedades p WHERE p.id=propiedad_id));
CREATE POLICY identity_admin ON public.identity_audit FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.version_listing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.canonical_id IS NULL THEN INSERT INTO public.canonical_properties DEFAULT VALUES RETURNING id INTO NEW.canonical_id; END IF;
    NEW.data_version:=1;
  ELSIF (to_jsonb(NEW)-ARRAY['data_version','updated_at','last_seen','fecha_scraping','evidence']) IS DISTINCT FROM
        (to_jsonb(OLD)-ARRAY['data_version','updated_at','last_seen','fecha_scraping','evidence']) THEN
    NEW.data_version:=OLD.data_version+1;
  ELSE NEW.data_version:=OLD.data_version;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER z_version_listing BEFORE INSERT OR UPDATE ON public.propiedades FOR EACH ROW EXECUTE FUNCTION public.version_listing();
CREATE OR REPLACE FUNCTION public.record_listing_observation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE kind text;
BEGIN
  IF TG_OP='UPDATE' AND NEW.data_version=OLD.data_version THEN RETURN NULL; END IF;
  INSERT INTO public.listing_observations(propiedad_id,version,observed_at,facts,evidence)
    VALUES(NEW.id,NEW.data_version,coalesce(NEW.last_seen,now()),to_jsonb(NEW)-ARRAY['evidence','updated_at'],NEW.evidence);
  kind:=CASE WHEN TG_OP='INSERT' THEN 'first_observed' WHEN NEW.precio<OLD.precio THEN 'price_drop'
    WHEN NEW.precio IS DISTINCT FROM OLD.precio THEN 'price_changed'
    WHEN OLD.availability='removed_confirmed' AND NEW.availability IN ('observed','reappeared') THEN 'reappeared' ELSE 'facts_changed' END;
  INSERT INTO public.property_events(propiedad_id,version,kind,previous_value,value)
    VALUES(NEW.id,NEW.data_version,kind,CASE WHEN TG_OP='UPDATE' THEN jsonb_build_object('precio',OLD.precio,'availability',OLD.availability) END,
      jsonb_build_object('precio',NEW.precio,'availability',NEW.availability));
  RETURN NULL;
END $$;
CREATE TRIGGER record_observation AFTER INSERT OR UPDATE ON public.propiedades FOR EACH ROW EXECUTE FUNCTION public.record_listing_observation();

CREATE OR REPLACE FUNCTION public.link_listing(p_listing uuid,p_canonical uuid,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_id uuid;new_id uuid:=p_canonical;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Operator required' USING ERRCODE='42501'; END IF;
  SELECT canonical_id INTO old_id FROM public.propiedades WHERE id=p_listing FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  IF new_id IS NULL THEN INSERT INTO public.canonical_properties DEFAULT VALUES RETURNING id INTO new_id; END IF;
  INSERT INTO public.identity_audit(propiedad_id,old_canonical_id,new_canonical_id,reason,actor) VALUES(p_listing,old_id,new_id,p_reason,auth.uid());
  UPDATE public.propiedades SET canonical_id=new_id WHERE id=p_listing;
  RETURN new_id;
END $$;
REVOKE ALL ON FUNCTION public.link_listing(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.link_listing(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ingest_raw_property(p_external_id text,p_portal text,p_url text,p_raw jsonb)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_row public.propiedades_raw%ROWTYPE;observed timestamptz;old_observed timestamptz;published_observed timestamptz;
BEGIN
  IF p_portal NOT IN ('fotocasa','pisos') OR p_external_id !~ ('^'||p_portal||'-[A-Za-z0-9_-]{1,100}$') OR jsonb_typeof(p_raw)<>'object' THEN RAISE EXCEPTION 'Invalid source data'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_portal||':'||p_external_id,0));
  SELECT * INTO old_row FROM public.propiedades_raw WHERE external_id=p_external_id AND portal_origen=p_portal FOR UPDATE;
  observed:=(p_raw#>>'{_evidence,observed_at}')::timestamptz;
  old_observed:=(old_row.raw_data#>>'{_evidence,observed_at}')::timestamptz;
  IF observed>now()+interval '5 minutes' THEN RAISE EXCEPTION 'Observation in future'; END IF;
  -- Raw retention must not permit an older HAR to overwrite newer published facts.
  SELECT last_seen INTO published_observed FROM public.propiedades
    WHERE external_id=p_external_id AND portal_origen=p_portal AND evidence->>'observed_at' IS NOT NULL;
  IF published_observed IS NOT NULL AND (observed IS NULL OR observed<published_observed) THEN RETURN 'stale'; END IF;
  IF old_row.id IS NULL THEN
    INSERT INTO public.propiedades_raw(external_id,portal_origen,url,raw_data) VALUES(p_external_id,p_portal,p_url,p_raw);RETURN 'inserted';
  END IF;
  IF old_observed IS NOT NULL AND (observed IS NULL OR old_observed>observed) THEN RETURN 'stale'; END IF;
  IF (old_row.raw_data-ARRAY['scraped_at','_evidence']) IS DISTINCT FROM (p_raw-ARRAY['scraped_at','_evidence']) OR old_row.url IS DISTINCT FROM p_url THEN
    UPDATE public.propiedades_raw SET raw_data=p_raw,url=p_url,procesado=false,intentos_procesamiento=0,error_procesamiento=NULL WHERE id=old_row.id;
    UPDATE public.propiedades SET activo=false,availability='needs_verification' WHERE external_id=p_external_id AND portal_origen=p_portal;
    RETURN 'updated';
  END IF;
  UPDATE public.propiedades_raw SET raw_data=p_raw WHERE id=old_row.id;
  UPDATE public.propiedades SET last_seen=coalesce(observed,now()),activo=true,availability='observed',evidence=coalesce(p_raw->'_evidence','{}')
    WHERE external_id=p_external_id AND portal_origen=p_portal AND old_row.procesado;
  RETURN 'unchanged';
END $$;

CREATE OR REPLACE FUNCTION public.ingest_listing_batch(p_id text,p_job uuid,p_portal text,p_records jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE previous public.ingestion_batches%ROWTYPE;r jsonb;n integer;
BEGIN
  IF jsonb_typeof(p_records)<>'array' OR jsonb_array_length(p_records) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid batch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_id,0));
  SELECT * INTO previous FROM public.ingestion_batches WHERE id=p_id;
  IF FOUND THEN
    IF previous.payload_sha256 IS DISTINCT FROM encode(sha256(convert_to(p_records::text,'UTF8')),'hex') OR previous.job_id IS DISTINCT FROM p_job THEN RAISE EXCEPTION 'Idempotency conflict'; END IF;
    RETURN previous.record_count;
  END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_records) LOOP
    IF r->>'portal_origen' IS DISTINCT FROM p_portal OR
      (p_portal='pisos' AND r->>'url' !~ '^https://(www\.)?pisos\.com/') OR
      (p_portal='fotocasa' AND r->>'url' !~ '^https://(www\.)?fotocasa\.es/') THEN RAISE EXCEPTION 'Invalid listing origin'; END IF;
    PERFORM public.ingest_raw_property(r->>'external_id',p_portal,r->>'url',r->'raw_data');
  END LOOP;
  n:=jsonb_array_length(p_records);
  INSERT INTO public.ingestion_batches(id,job_id,payload_sha256,record_count) VALUES(p_id,p_job,encode(sha256(convert_to(p_records::text,'UTF8')),'hex'),n);
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.ingest_listing_batch(text,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_listing_batch(text,uuid,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION public.complete_raw_property(p_id uuid,p_updated_at timestamptz,p_property jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.propiedades_raw%ROWTYPE; p public.propiedades%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.propiedades_raw WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR r.updated_at IS DISTINCT FROM p_updated_at THEN
    RAISE EXCEPTION 'Source changed during processing; retry';
  END IF;
  p := jsonb_populate_record(NULL::public.propiedades,p_property);
  IF p.precio IS NULL OR p.precio<=0 OR nullif(p.ubicacion,'') IS NULL THEN RAISE EXCEPTION 'Invalid property'; END IF;
  INSERT INTO public.propiedades(external_id,portal_origen,url,titulo,descripcion,precio,metros,precio_m2,
    ubicacion,ciudad,distrito,provincia,tipo_propiedad,dormitorios,banos,ano_construccion,condition,
    tiene_ascensor,tiene_parking,tiene_trastero,imagenes,activo,last_seen,fecha_scraping,evidence,latitude,longitude,location_precision,availability)
  VALUES(r.external_id,r.portal_origen,r.url,p.titulo,p.descripcion,p.precio,p.metros,p.precio_m2,
    p.ubicacion,p.ciudad,p.distrito,p.provincia,p.tipo_propiedad,p.dormitorios,p.banos,p.ano_construccion,p.condition,
    p.tiene_ascensor,p.tiene_parking,p.tiene_trastero,p.imagenes,true,coalesce((r.raw_data#>>'{_evidence,observed_at}')::timestamptz,now()),now(),coalesce(r.raw_data->'_evidence','{}'),p.latitude,p.longitude,coalesce(p.location_precision,'unknown'),'observed')
  ON CONFLICT(external_id,portal_origen) DO UPDATE SET url=excluded.url,titulo=excluded.titulo,
    descripcion=excluded.descripcion,precio=excluded.precio,metros=excluded.metros,precio_m2=excluded.precio_m2,
    ubicacion=excluded.ubicacion,ciudad=excluded.ciudad,distrito=excluded.distrito,provincia=excluded.provincia,
    tipo_propiedad=excluded.tipo_propiedad,dormitorios=excluded.dormitorios,banos=excluded.banos,
    ano_construccion=excluded.ano_construccion,condition=excluded.condition,tiene_ascensor=excluded.tiene_ascensor,
    tiene_parking=excluded.tiene_parking,tiene_trastero=excluded.tiene_trastero,imagenes=excluded.imagenes,
    activo=true,last_seen=excluded.last_seen,fecha_scraping=excluded.fecha_scraping,evidence=excluded.evidence,latitude=excluded.latitude,longitude=excluded.longitude,location_precision=excluded.location_precision,availability='observed';
  UPDATE public.propiedades_raw SET procesado=true,error_procesamiento=NULL WHERE id=p_id;
END $$;
COMMIT;
