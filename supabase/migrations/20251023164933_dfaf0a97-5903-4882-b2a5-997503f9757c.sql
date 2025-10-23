-- Añadir campo perfil a la tabla clientes
ALTER TABLE clientes ADD COLUMN perfil TEXT CHECK (perfil IN ('alquilar', 'vender', 'vivir'));

-- Establecer un valor por defecto para registros existentes
UPDATE clientes SET perfil = 'vivir' WHERE perfil IS NULL;

-- Hacer el campo obligatorio
ALTER TABLE clientes ALTER COLUMN perfil SET NOT NULL;
ALTER TABLE clientes ALTER COLUMN perfil SET DEFAULT 'vivir';