import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[Execute All Scrapers] Iniciando ejecución de todos los scrapers');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener todos los scrapers activos
    const { data: triggers, error: fetchError } = await supabase
      .from('scraping_triggers')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (fetchError) {
      throw new Error(`Error obteniendo triggers: ${fetchError.message}`);
    }

    if (!triggers || triggers.length === 0) {
      console.log('[Execute All Scrapers] No hay scrapers activos configurados');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No hay scrapers activos configurados',
          scrapers_ejecutados: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Execute All Scrapers] Encontrados ${triggers.length} scrapers activos`);

    // Ejecutar cada scraper
    const resultados = [];
    for (const trigger of triggers) {
      try {
        console.log(`[Execute All Scrapers] Lanzando scraper: ${trigger.nombre} (${trigger.portal})`);
        
        // Llamar al scraping-service para cada trigger
        const { data, error } = await supabase.functions.invoke('scraping-service', {
          body: {
            portal: trigger.portal,
            ubicacion: trigger.ubicacion,
            max_pages: trigger.max_pages,
          }
        });

        if (error) {
          console.error(`[Execute All Scrapers] Error en ${trigger.nombre}:`, error);
          resultados.push({
            trigger: trigger.nombre,
            portal: trigger.portal,
            ubicacion: trigger.ubicacion,
            success: false,
            error: error.message,
          });
        } else {
          console.log(`[Execute All Scrapers] ✓ ${trigger.nombre} iniciado correctamente`);
          resultados.push({
            trigger: trigger.nombre,
            portal: trigger.portal,
            ubicacion: trigger.ubicacion,
            success: true,
            ...data,
          });
        }

        // Actualizar ultima_ejecucion
        await supabase
          .from('scraping_triggers')
          .update({ ultima_ejecucion: new Date().toISOString() })
          .eq('id', trigger.id);

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Execute All Scrapers] Error ejecutando ${trigger.nombre}:`, errorMsg);
        resultados.push({
          trigger: trigger.nombre,
          portal: trigger.portal,
          ubicacion: trigger.ubicacion,
          success: false,
          error: errorMsg,
        });
      }
    }

    const exitosos = resultados.filter(r => r.success).length;
    const fallidos = resultados.filter(r => !r.success).length;

    console.log(`[Execute All Scrapers] Finalizado: ${exitosos} exitosos, ${fallidos} fallidos`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Ejecutados ${triggers.length} scrapers`,
        exitosos,
        fallidos,
        resultados,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Execute All Scrapers] Error general:', error.message);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Error ejecutando scrapers'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
