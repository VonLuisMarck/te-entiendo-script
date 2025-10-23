-- Fix nullable user_id in clientes table (critical security issue)
-- First check if there are any NULL user_id records and handle them
DO $$
BEGIN
  -- Delete any orphaned records without user_id (should not exist in production)
  DELETE FROM clientes WHERE user_id IS NULL;
END $$;

-- Make user_id NOT NULL
ALTER TABLE clientes 
ALTER COLUMN user_id SET NOT NULL;

-- Create user roles system for admin access control
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver logs" ON scraping_logs;
DROP POLICY IF EXISTS "Only admins can view scraping logs" ON scraping_logs;
DROP POLICY IF EXISTS "Service can insert scraping logs" ON scraping_logs;

-- Allow users to view their own roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only admins can manage roles
CREATE POLICY "Admins can manage all roles" ON public.user_roles
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Restrict scraping_logs to admin users only
CREATE POLICY "Only admins can view scraping logs" ON scraping_logs
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Allow the scraping service to insert logs (called by Edge Function)
CREATE POLICY "Service can insert scraping logs" ON scraping_logs
  FOR INSERT
  WITH CHECK (true);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role TO authenticated;