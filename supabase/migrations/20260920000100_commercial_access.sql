-- Apply to a backup-tested staging copy first. No customer data is deleted.
BEGIN;

-- A policy name is not an authorization check. Earlier 'Service role' policies
-- applied to PUBLIC and bypassed owner/tier policies through permissive OR.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND policyname ILIKE 'Service%'
  LOOP
    EXECUTE format('ALTER POLICY %I ON %I.%I TO service_role', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- The dashboard needs explicit admin access after removing the PUBLIC bypass.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','criterios_busqueda','propiedades','matchings',
    'scraping_logs','scraping_triggers','propiedades_raw','batch_processing_logs',
    'metricas_barrios','metricas_barrios_historico','metricas_inversores',
    'propiedades_historico','matching_feedback','valoraciones_reforma','stripe_customers']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY commercial_admin_access ON public.%I FOR ALL TO authenticated
        USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t);
    END IF;
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.assign_admin_role(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_admin_role(text) TO service_role;
REVOKE ALL ON FUNCTION public.archivar_propiedades_inactivas() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archivar_propiedades_inactivas() TO service_role;
REVOKE ALL ON FUNCTION public.desactivar_propiedades_no_vistas(integer,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.desactivar_propiedades_no_vistas(integer,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.get_coste_mensual_actual() FROM PUBLIC, anon;

-- Public marketing does not need a dump of listings or market history.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['propiedades','metricas_barrios','metricas_barrios_historico',
    'propiedades_historico','metricas_inversores']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.protect_customer_entitlements()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE editable text[] := ARRAY['nombre','email','telefono','presupuesto_min','presupuesto_max','perfil','updated_at'];
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres','supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (to_jsonb(NEW) - editable) IS DISTINCT FROM (to_jsonb(OLD) - editable) THEN
      RAISE EXCEPTION 'Only an operator can change subscription, ownership or usage' USING ERRCODE = '42501';
    END IF;
  ELSE
    -- Normalize every new self-service account to Free. Request-supplied billing
    -- fields never grant access. Admin-created clients keep their configured plan.
    NEW.tipo_suscripcion := 'free'; NEW.limite_matchings_mes := 5;
    NEW.matchings_usados_mes := 0; NEW.estimaciones_reforma_mes := 0;
    NEW.fecha_reset_matchings := date_trunc('month', now() + interval '1 month');
    NEW.max_ciudades_acceso := NULL; NEW.dias_historico_acceso := NULL;
    NEW.puede_descargar_datos := false; NEW.formatos_descarga := NULL;
    NEW.tiene_acceso_ine := false; NEW.tiene_api_access := false;
    NEW.periodicidad_alertas := 'ninguna'; NEW.max_ubicaciones_alerta := 0;
    NEW.activo := true;
  END IF;
  RETURN NEW;
END $$;
-- Runs before the legacy monthly reset trigger, whose counters are server-managed.
CREATE TRIGGER a_protect_customer_entitlements BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.protect_customer_entitlements();

CREATE OR REPLACE FUNCTION public.protect_matching_result()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_user IN ('postgres','supabase_admin')
     OR public.has_role(auth.uid(), 'admin') THEN RETURN NEW; END IF;
  IF (to_jsonb(NEW) - ARRAY['visto','favorito','updated_at']) IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['visto','favorito','updated_at']) THEN
    RAISE EXCEPTION 'Only seen/favorite fields are editable' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_matching_result BEFORE UPDATE ON public.matchings
FOR EACH ROW EXECUTE FUNCTION public.protect_matching_result();

-- Feedback must refer to an actual matching of this same client/property.
CREATE POLICY feedback_requires_own_matching ON public.matching_feedback AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.matchings m JOIN public.clientes c ON c.id = m.cliente_id
  WHERE m.id = matching_feedback.matching_id AND m.cliente_id = matching_feedback.cliente_id
    AND m.propiedad_id = matching_feedback.propiedad_id AND c.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR EXISTS (
  SELECT 1 FROM public.matchings m JOIN public.clientes c ON c.id = m.cliente_id
  WHERE m.id = matching_feedback.matching_id AND m.cliente_id = matching_feedback.cliente_id
    AND m.propiedad_id = matching_feedback.propiedad_id AND c.user_id = auth.uid()));

-- Profile creation after a confirmed login, safe under concurrent tabs/retries.
-- Existing admin-managed clients are preserved; no global user_id unique index.
CREATE OR REPLACE FUNCTION public.ensure_cliente_profile()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); cid uuid; user_email text; user_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
  SELECT id INTO cid FROM public.clientes WHERE user_id = uid ORDER BY created_at, id LIMIT 1;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  SELECT email, left(coalesce(nullif(raw_user_meta_data->>'nombre', ''), split_part(email, '@', 1)), 100)
    INTO user_email, user_name FROM auth.users WHERE id = uid;
  INSERT INTO public.clientes(user_id,nombre,email,tipo_suscripcion,limite_matchings_mes)
    VALUES(uid,user_name,user_email,'free',5) RETURNING id INTO cid;
  RETURN cid;
END $$;
REVOKE ALL ON FUNCTION public.ensure_cliente_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_cliente_profile() TO authenticated;

ALTER TABLE public.criterios_busqueda
  ADD COLUMN banos_min integer CHECK (banos_min >= 0),
  ADD COLUMN flexibilidad_presupuesto integer NOT NULL DEFAULT 10 CHECK (flexibilidad_presupuesto BETWEEN 0 AND 30);

-- NOT VALID preserves legacy rows; new/changed rows must obey the constraints.
ALTER TABLE public.clientes ADD CONSTRAINT commercial_budget_range
  CHECK ((presupuesto_min IS NULL OR presupuesto_min >= 0)
    AND (presupuesto_max IS NULL OR presupuesto_max > 0)
    AND (presupuesto_min IS NULL OR presupuesto_max IS NULL OR presupuesto_min <= presupuesto_max)) NOT VALID;
ALTER TABLE public.criterios_busqueda ADD CONSTRAINT commercial_area_range
  CHECK ((metros_min IS NULL OR metros_min > 0) AND (metros_max IS NULL OR metros_max > 0)
    AND (metros_min IS NULL OR metros_max IS NULL OR metros_min <= metros_max)) NOT VALID;
COMMIT;
