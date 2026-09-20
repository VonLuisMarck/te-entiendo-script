import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from "@supabase/supabase-js";

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

        if (error || !data?.success || !data?.job_id) {
          console.error(`[Execute All Scrapers] Error en ${trigger.nombre}:`, error);
          resultados.push({
            trigger: trigger.nombre,
            portal: trigger.portal,
            ubicacion: trigger.ubicacion,
            success: false,
            error: error?.message || data?.error || 'No se confirmó el inicio del scraper',
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

        if (!error && data?.success && data?.job_id) {
        // Actualizar ultima_ejecucion
        await supabase
          .from('scraping_triggers')
          .update({ ultima_ejecucion: new Date().toISOString() })
          .eq('id', trigger.id);
        }

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
        success: fallidos === 0,
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

