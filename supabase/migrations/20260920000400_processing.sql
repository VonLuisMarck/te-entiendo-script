BEGIN;
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
    tiene_ascensor,tiene_parking,tiene_trastero,imagenes,activo,last_seen,fecha_scraping)
  VALUES(r.external_id,r.portal_origen,r.url,p.titulo,p.descripcion,p.precio,p.metros,p.precio_m2,
    p.ubicacion,p.ciudad,p.distrito,p.provincia,p.tipo_propiedad,p.dormitorios,p.banos,p.ano_construccion,p.condition,
    p.tiene_ascensor,p.tiene_parking,p.tiene_trastero,p.imagenes,true,now(),now())
  ON CONFLICT(external_id,portal_origen) DO UPDATE SET url=excluded.url,titulo=excluded.titulo,
    descripcion=excluded.descripcion,precio=excluded.precio,metros=excluded.metros,precio_m2=excluded.precio_m2,
    ubicacion=excluded.ubicacion,ciudad=excluded.ciudad,distrito=excluded.distrito,provincia=excluded.provincia,
    tipo_propiedad=excluded.tipo_propiedad,dormitorios=excluded.dormitorios,banos=excluded.banos,
    ano_construccion=excluded.ano_construccion,condition=excluded.condition,tiene_ascensor=excluded.tiene_ascensor,
    tiene_parking=excluded.tiene_parking,tiene_trastero=excluded.tiene_trastero,imagenes=excluded.imagenes,
    activo=true,last_seen=excluded.last_seen,fecha_scraping=excluded.fecha_scraping;
  UPDATE public.propiedades_raw SET procesado=true,error_procesamiento=NULL WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.complete_raw_property(uuid,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_raw_property(uuid,timestamptz,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.invalidate_changed_search()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_TABLE_NAME = 'criterios_busqueda' THEN
    IF TG_OP <> 'INSERT' THEN UPDATE public.matchings SET score=0 WHERE cliente_id=OLD.cliente_id; END IF;
    IF TG_OP <> 'DELETE' THEN UPDATE public.matchings SET score=0 WHERE cliente_id=NEW.cliente_id; END IF;
  ELSE
    UPDATE public.matchings SET score=0 WHERE cliente_id=NEW.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER invalidate_search_matches AFTER INSERT OR UPDATE OR DELETE ON public.criterios_busqueda
FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_search();
CREATE TRIGGER invalidate_budget_matches AFTER UPDATE ON public.clientes
FOR EACH ROW WHEN (OLD.presupuesto_min IS DISTINCT FROM NEW.presupuesto_min OR OLD.presupuesto_max IS DISTINCT FROM NEW.presupuesto_max OR OLD.perfil IS DISTINCT FROM NEW.perfil)
EXECUTE FUNCTION public.invalidate_changed_search();

CREATE OR REPLACE FUNCTION public.invalidate_changed_property()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['last_seen','updated_at','fecha_scraping']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['last_seen','updated_at','fecha_scraping']) THEN
    UPDATE public.matchings SET score=0 WHERE propiedad_id=NEW.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER invalidate_property_matches AFTER UPDATE ON public.propiedades
FOR EACH ROW EXECUTE FUNCTION public.invalidate_changed_property();
COMMIT;
