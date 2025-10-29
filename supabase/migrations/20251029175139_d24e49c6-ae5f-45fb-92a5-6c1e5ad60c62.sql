-- Función para crear el primer usuario admin
-- Esta función busca un usuario específico por email y le asigna el rol de admin
CREATE OR REPLACE FUNCTION public.assign_admin_role(user_email TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_user_id UUID;
  result json;
BEGIN
  -- Buscar el usuario por email en auth.users
  SELECT id INTO target_user_id
  FROM auth.users
  WHERE email = user_email
  LIMIT 1;

  IF target_user_id IS NULL THEN
    result := json_build_object(
      'success', false,
      'message', 'Usuario no encontrado con el email: ' || user_email
    );
    RETURN result;
  END IF;

  -- Verificar si ya tiene rol de admin
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = target_user_id AND role = 'admin'
  ) THEN
    result := json_build_object(
      'success', false,
      'message', 'El usuario ya tiene rol de administrador'
    );
    RETURN result;
  END IF;

  -- Asignar rol de admin
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin');

  result := json_build_object(
    'success', true,
    'message', 'Rol de administrador asignado exitosamente',
    'user_id', target_user_id
  );
  
  RETURN result;
END;
$$;

-- Crear el primer usuario admin con email admin@admin.com si existe en auth.users
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Buscar si existe el usuario admin@admin.com
  SELECT id INTO admin_user_id
  FROM auth.users
  WHERE email = 'admin@admin.com'
  LIMIT 1;

  -- Si existe y no tiene rol, asignarlo
  IF admin_user_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = admin_user_id AND role = 'admin'
    ) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (admin_user_id, 'admin');
      
      RAISE NOTICE 'Rol de admin asignado a admin@admin.com';
    END IF;
  END IF;
END $$;