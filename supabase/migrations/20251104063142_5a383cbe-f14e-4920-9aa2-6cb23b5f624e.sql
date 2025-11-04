-- Añadir campos de control de acceso a clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS max_ciudades_acceso INTEGER,
ADD COLUMN IF NOT EXISTS dias_historico_acceso INTEGER,
ADD COLUMN IF NOT EXISTS puede_descargar_datos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS formatos_descarga TEXT[],
ADD COLUMN IF NOT EXISTS tiene_acceso_ine BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS tiene_api_access BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS periodicidad_alertas TEXT DEFAULT 'ninguna',
ADD COLUMN IF NOT EXISTS max_ubicaciones_alerta INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimaciones_reforma_mes INTEGER DEFAULT 0;

-- Crear tabla de métricas para inversores
CREATE TABLE IF NOT EXISTS metricas_inversores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Geolocalización
  provincia TEXT NOT NULL,
  ciudad TEXT,
  distrito TEXT,
  
  -- Métricas precio
  precio_m2_medio NUMERIC,
  precio_m2_min NUMERIC,
  precio_m2_max NUMERIC,
  precio_m2_percentil_25 NUMERIC,
  precio_m2_percentil_50 NUMERIC,
  precio_m2_percentil_75 NUMERIC,
  
  -- Métricas alquiler
  alquiler_m2_medio NUMERIC,
  yield_bruto NUMERIC,
  yield_neto NUMERIC,
  
  -- Datos macro (INE)
  poblacion INTEGER,
  renta_media_hogar NUMERIC,
  tasa_desempleo NUMERIC,
  edad_media NUMERIC,
  
  -- Tendencias
  variacion_mensual NUMERIC,
  variacion_anual NUMERIC,
  indice_dinamismo NUMERIC,
  proyeccion_revalorizacion_1y NUMERIC,
  proyeccion_revalorizacion_3y NUMERIC,
  
  -- Oferta/Demanda
  total_propiedades_venta INTEGER,
  total_propiedades_alquiler INTEGER,
  ratio_demanda_oferta NUMERIC,
  dias_medio_venta NUMERIC,
  
  -- Metadatos
  fecha_calculo TIMESTAMP DEFAULT NOW(),
  fuente_datos TEXT[],
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(provincia, ciudad, distrito, fecha_calculo)
);

-- Habilitar RLS en metricas_inversores
ALTER TABLE metricas_inversores ENABLE ROW LEVEL SECURITY;

-- Policy: Solo INVESTOR puede ver métricas por provincia
CREATE POLICY "Investor puede ver metricas provincia"
ON metricas_inversores FOR SELECT
USING (
  distrito IS NULL AND
  EXISTS (
    SELECT 1 FROM clientes
    WHERE user_id = auth.uid()
    AND tipo_suscripcion IN ('investor', 'investor_platino')
  )
);

-- Policy: Solo INVESTOR PLATINO puede ver métricas por distrito
CREATE POLICY "Investor Platino puede ver metricas distrito"
ON metricas_inversores FOR SELECT
USING (
  distrito IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM clientes
    WHERE user_id = auth.uid()
    AND tipo_suscripcion = 'investor_platino'
  )
);

-- Policy: Service role puede gestionar métricas
CREATE POLICY "Service role puede gestionar metricas inversores"
ON metricas_inversores FOR ALL
USING (true)
WITH CHECK (true);

-- Índices para queries rápidas
CREATE INDEX IF NOT EXISTS idx_metricas_inv_provincia ON metricas_inversores(provincia);
CREATE INDEX IF NOT EXISTS idx_metricas_inv_ciudad ON metricas_inversores(ciudad);
CREATE INDEX IF NOT EXISTS idx_metricas_inv_distrito ON metricas_inversores(distrito);
CREATE INDEX IF NOT EXISTS idx_metricas_inv_fecha ON metricas_inversores(fecha_calculo DESC);