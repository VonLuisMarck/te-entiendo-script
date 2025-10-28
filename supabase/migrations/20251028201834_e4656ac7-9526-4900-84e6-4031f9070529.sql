-- Añadir tipo de suscripción a clientes
DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS tipo_suscripcion subscription_tier DEFAULT 'free';