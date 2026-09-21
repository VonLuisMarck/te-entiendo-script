import { supabase } from '@/integrations/supabase/client';

// Only call after an authenticated session exists; email confirmation may delay it.
export async function ensureClientProfile(): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_cliente_profile');
  if (error || !data) throw error || new Error('No se pudo crear el perfil');
  return data;
}
