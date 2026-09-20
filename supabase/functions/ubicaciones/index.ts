import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from '@supabase/supabase-js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method === 'GET') {
      console.log('Fetching ubicaciones from database...');
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data, error } = await supabase
        .from('ubicaciones_config')
        .select('contenido, version')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('Database error:', error);
        return new Response(
          JSON.stringify({ error: 'Error al cargar ubicaciones' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!data) {
        console.error('No ubicaciones found in database');
        return new Response(
          JSON.stringify({ error: 'No se encontraron ubicaciones' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`Returning ubicaciones version ${data.version}`);
      
      return new Response(
        JSON.stringify(data.contenido, null, 2),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json; charset=utf-8',
            'X-Version': data.version.toString()
          } 
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método no permitido' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en ubicaciones:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

