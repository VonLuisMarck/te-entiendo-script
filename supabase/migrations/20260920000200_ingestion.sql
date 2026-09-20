BEGIN;
CREATE OR REPLACE FUNCTION public.ingest_raw_property(
  p_external_id text, p_portal text, p_url text, p_raw jsonb
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE old_row public.propiedades_raw%ROWTYPE; outcome text;
BEGIN
  IF p_portal NOT IN ('fotocasa','pisos') OR nullif(p_external_id,'') IS NULL OR jsonb_typeof(p_raw) <> 'object' THEN
    RAISE EXCEPTION 'Invalid source data';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_portal || ':' || p_external_id, 0));
  SELECT * INTO old_row FROM public.propiedades_raw WHERE external_id=p_external_id AND portal_origen=p_portal FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.propiedades_raw(external_id,portal_origen,url,raw_data) VALUES(p_external_id,p_portal,p_url,p_raw);
    RETURN 'inserted';
  ELSIF (old_row.raw_data - 'scraped_at') IS DISTINCT FROM (p_raw - 'scraped_at') OR old_row.url IS DISTINCT FROM p_url THEN
    UPDATE public.propiedades_raw SET raw_data=p_raw,url=p_url,procesado=false,
      intentos_procesamiento=0,error_procesamiento=NULL WHERE id=old_row.id;
    -- Changed facts await processing; don't advertise the old price as current.
    UPDATE public.propiedades SET activo=false WHERE external_id=p_external_id AND portal_origen=p_portal;
    RETURN 'updated';
  ELSE
    UPDATE public.propiedades SET last_seen=now(),activo=true
      WHERE external_id=p_external_id AND portal_origen=p_portal AND old_row.procesado;
    RETURN 'unchanged';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ingest_raw_property(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_raw_property(text,text,text,jsonb) TO service_role;

CREATE TABLE public.processing_locks (
  name text PRIMARY KEY, token uuid NOT NULL, expires_at timestamptz NOT NULL
);
ALTER TABLE public.processing_locks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.processing_locks FROM anon,authenticated;
CREATE OR REPLACE FUNCTION public.acquire_processing_lock(p_name text,p_seconds integer DEFAULT 180)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE acquired uuid;
BEGIN
  INSERT INTO public.processing_locks(name,token,expires_at)
    VALUES(p_name,gen_random_uuid(),now()+make_interval(secs=>greatest(1,least(p_seconds,300))))
  ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at
    WHERE processing_locks.expires_at < now()
  RETURNING token INTO acquired;
  RETURN acquired;
END $$;
CREATE OR REPLACE FUNCTION public.release_processing_lock(p_name text,p_token uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  DELETE FROM public.processing_locks WHERE name=p_name AND token=p_token;
$$;
REVOKE ALL ON FUNCTION public.acquire_processing_lock(text,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.release_processing_lock(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_processing_lock(text,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_processing_lock(text,uuid) TO service_role;
COMMIT;
