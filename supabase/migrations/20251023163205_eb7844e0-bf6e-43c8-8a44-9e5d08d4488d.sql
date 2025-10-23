-- Tabla de clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT,
  presupuesto_min DECIMAL(10,2),
  presupuesto_max DECIMAL(10,2),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de criterios de búsqueda por cliente
CREATE TABLE public.criterios_busqueda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  ubicaciones TEXT[] NOT NULL,
  tipo_propiedad TEXT[], -- 'piso', 'casa', 'chalet', etc.
  dormitorios_min INTEGER,
  metros_min DECIMAL(8,2),
  metros_max DECIMAL(8,2),
  precio_m2_max DECIMAL(10,2),
  condition TEXT[], -- 'nuevo', 'buen estado', 'a reformar'
  ano_construccion_min INTEGER,
  tiene_ascensor BOOLEAN,
  tiene_parking BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de propiedades scrapeadas
CREATE TABLE public.propiedades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL, -- ID del portal (ej: fotocasa-12345)
  portal_origen TEXT NOT NULL, -- 'fotocasa', 'idealista', etc.
  titulo TEXT NOT NULL,
  descripcion TEXT,
  precio DECIMAL(10,2) NOT NULL,
  ubicacion TEXT NOT NULL,
  tipo_propiedad TEXT NOT NULL,
  dormitorios INTEGER,
  banos INTEGER,
  metros DECIMAL(8,2),
  precio_m2 DECIMAL(10,2),
  condition TEXT,
  ano_construccion INTEGER,
  tiene_ascensor BOOLEAN,
  tiene_parking BOOLEAN,
  url TEXT NOT NULL,
  imagenes TEXT[],
  activo BOOLEAN DEFAULT true,
  fecha_scraping TIMESTAMPTZ DEFAULT now(),
  fecha_publicacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabla de matchings (scoring entre clientes y propiedades)
CREATE TABLE public.matchings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE CASCADE,
  propiedad_id UUID REFERENCES public.propiedades(id) ON DELETE CASCADE,
  score DECIMAL(5,2) NOT NULL, -- 0-100
  criterios_cumplidos JSONB, -- detalle de qué criterios cumple
  notificado BOOLEAN DEFAULT false,
  visto BOOLEAN DEFAULT false,
  favorito BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, propiedad_id)
);

-- Tabla de logs de scraping
CREATE TABLE public.scraping_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal TEXT NOT NULL,
  ubicacion TEXT,
  propiedades_encontradas INTEGER,
  propiedades_nuevas INTEGER,
  propiedades_actualizadas INTEGER,
  errores TEXT[],
  duracion_segundos INTEGER,
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para optimizar búsquedas
CREATE INDEX idx_propiedades_portal ON public.propiedades(portal_origen);
CREATE INDEX idx_propiedades_ubicacion ON public.propiedades(ubicacion);
CREATE INDEX idx_propiedades_precio ON public.propiedades(precio);
CREATE INDEX idx_propiedades_activo ON public.propiedades(activo);
CREATE INDEX idx_matchings_cliente ON public.matchings(cliente_id);
CREATE INDEX idx_matchings_score ON public.matchings(score DESC);
CREATE INDEX idx_matchings_notificado ON public.matchings(notificado);

-- Enable Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.criterios_busqueda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.propiedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraping_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para clientes
CREATE POLICY "Los usuarios pueden ver sus propios clientes"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden crear sus propios clientes"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios clientes"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id);

-- Políticas RLS para criterios de búsqueda
CREATE POLICY "Los usuarios pueden ver criterios de sus clientes"
  ON public.criterios_busqueda FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = criterios_busqueda.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Los usuarios pueden crear criterios para sus clientes"
  ON public.criterios_busqueda FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = criterios_busqueda.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Los usuarios pueden actualizar criterios de sus clientes"
  ON public.criterios_busqueda FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = criterios_busqueda.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

-- Políticas RLS para propiedades (públicas para lectura)
CREATE POLICY "Todos pueden ver propiedades activas"
  ON public.propiedades FOR SELECT
  USING (activo = true);

-- Políticas RLS para matchings
CREATE POLICY "Los usuarios pueden ver sus matchings"
  ON public.matchings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = matchings.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

CREATE POLICY "Los usuarios pueden actualizar sus matchings"
  ON public.matchings FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.clientes 
    WHERE clientes.id = matchings.cliente_id 
    AND clientes.user_id = auth.uid()
  ));

-- Políticas RLS para scraping_logs (solo lectura para usuarios autenticados)
CREATE POLICY "Usuarios autenticados pueden ver logs"
  ON public.scraping_logs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_criterios_updated_at
  BEFORE UPDATE ON public.criterios_busqueda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_propiedades_updated_at
  BEFORE UPDATE ON public.propiedades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matchings_updated_at
  BEFORE UPDATE ON public.matchings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función para calcular precio por m2
CREATE OR REPLACE FUNCTION public.calcular_precio_m2()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.metros > 0 AND NEW.precio > 0 THEN
    NEW.precio_m2 = NEW.precio / NEW.metros;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER calcular_precio_m2_trigger
  BEFORE INSERT OR UPDATE ON public.propiedades
  FOR EACH ROW EXECUTE FUNCTION public.calcular_precio_m2();