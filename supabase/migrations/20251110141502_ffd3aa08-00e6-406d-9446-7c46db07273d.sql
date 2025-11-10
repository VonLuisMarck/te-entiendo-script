-- Añadir los mismos campos nuevos a propiedades_historico
ALTER TABLE propiedades_historico 
ADD COLUMN IF NOT EXISTS tiene_trastero BOOLEAN,
ADD COLUMN IF NOT EXISTS contacto_email TEXT,
ADD COLUMN IF NOT EXISTS contacto_telefono TEXT;

-- Ya tiene ciudad, distrito y provincia, así que solo añadimos comentarios
COMMENT ON COLUMN propiedades_historico.tiene_trastero IS 'Indica si la propiedad incluía trastero';
COMMENT ON COLUMN propiedades_historico.contacto_email IS 'Email del anunciante (histórico)';
COMMENT ON COLUMN propiedades_historico.contacto_telefono IS 'Teléfono del anunciante (histórico)';