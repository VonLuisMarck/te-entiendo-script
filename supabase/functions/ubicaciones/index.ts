import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import ubicacionesData from "./ubicaciones.json" with { type: "json" };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET: Devolver todas las ubicaciones
    if (req.method === 'GET') {
      return new Response(
        JSON.stringify(ubicacionesData, null, 2),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json; charset=utf-8' 
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
