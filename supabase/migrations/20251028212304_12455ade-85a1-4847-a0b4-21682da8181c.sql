-- Modificar el enum de subscription_tier para incluir los nuevos tiers
ALTER TYPE subscription_tier RENAME TO subscription_tier_old;

CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'investor', 'investor_platino');

-- Actualizar la columna para usar el nuevo tipo
ALTER TABLE clientes ALTER COLUMN tipo_suscripcion DROP DEFAULT;
ALTER TABLE clientes ALTER COLUMN tipo_suscripcion TYPE subscription_tier USING 
  CASE tipo_suscripcion::text
    WHEN 'premium' THEN 'investor_platino'::subscription_tier
    ELSE tipo_suscripcion::text::subscription_tier
  END;
ALTER TABLE clientes ALTER COLUMN tipo_suscripcion SET DEFAULT 'free'::subscription_tier;

-- Eliminar el tipo antiguo
DROP TYPE subscription_tier_old;