-- Añadir campos de ubicación normalizada
ALTER TABLE propiedades 
ADD COLUMN IF NOT EXISTS ciudad TEXT,
ADD COLUMN IF NOT EXISTS distrito TEXT,
ADD COLUMN IF NOT EXISTS provincia TEXT;

-- Añadir campo de trastero
ALTER TABLE propiedades 
ADD COLUMN IF NOT EXISTS tiene_trastero BOOLEAN;

-- Añadir datos de contacto del anunciante
ALTER TABLE propiedades 
ADD COLUMN IF NOT EXISTS contacto_email TEXT,
ADD COLUMN IF NOT EXISTS contacto_telefono TEXT;

-- Crear índices para mejorar búsquedas por ubicación
CREATE INDEX IF NOT EXISTS idx_propiedades_ciudad ON propiedades(ciudad);
CREATE INDEX IF NOT EXISTS idx_propiedades_provincia ON propiedades(provincia);
CREATE INDEX IF NOT EXISTS idx_propiedades_ciudad_distrito ON propiedades(ciudad, distrito) WHERE distrito IS NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN propiedades.ciudad IS 'Ciudad normalizada (solo municipios >50k habitantes)';
COMMENT ON COLUMN propiedades.distrito IS 'Distrito/barrio (solo para municipios >300k habitantes)';
COMMENT ON COLUMN propiedades.provincia IS 'Provincia española normalizada';
COMMENT ON COLUMN propiedades.tiene_trastero IS 'Indica si la propiedad incluye trastero';
COMMENT ON COLUMN propiedades.contacto_email IS 'Email del anunciante para contacto';
COMMENT ON COLUMN propiedades.contacto_telefono IS 'Teléfono del anunciante para contacto';