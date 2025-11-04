import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, frequency } = await req.json();

    console.log(`Acción de cron job: ${action}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

    switch (action) {
      case 'start_scrapers': {
        // Activar scrapers cada 6 horas
        const query = `
          SELECT cron.schedule(
            'execute-all-scrapers-every-6h',
            '0 */6 * * *',
            $$
            SELECT net.http_post(
              url:='${supabaseUrl}/functions/v1/execute-all-scrapers',
              headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${supabaseKey}"}'::jsonb,
              body:=concat('{"timestamp": "', now(), '"}')::jsonb
            ) as request_id;
            $$
          );
        `;
        console.log('Activando scrapers...');
        break;
      }

      case 'stop_scrapers': {
        // Desactivar scrapers - buscar el job por nombre y eliminarlo
        const query = `
          SELECT cron.unschedule(jobid) 
          FROM cron.job 
          WHERE jobname = 'execute-all-scrapers-every-6h';
        `;
        console.log('Desactivando scrapers...');
        break;
      }

      case 'start_cleanup': {
        // Activar limpieza
        const cronFreq = frequency || '0 */2 * * *';
        const query = `
          SELECT cron.schedule(
            'cleanup-inactive-properties',
            '${cronFreq}',
            $$SELECT desactivar_propiedades_no_vistas(2);$$
          );
        `;
        console.log('Activando limpieza...');
        break;
      }

      case 'stop_cleanup': {
        // Desactivar limpieza
        const query = `
          SELECT cron.unschedule(jobid) 
          FROM cron.job 
          WHERE jobname = 'cleanup-inactive-properties';
        `;
        console.log('Desactivando limpieza...');
        break;
      }

      case 'update_cleanup_frequency': {
        // Actualizar frecuencia de limpieza
        const cronFreq = frequency || '0 */2 * * *';
        console.log(`Actualizando frecuencia de limpieza a: ${cronFreq}`);
        // Primero desactivar
        await fetch(`${supabaseUrl}/functions/v1/manage-cron-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stop_cleanup' })
        });
        // Luego reactivar con nueva frecuencia
        await fetch(`${supabaseUrl}/functions/v1/manage-cron-jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start_cleanup', frequency: cronFreq })
        });
        break;
      }

      default:
        throw new Error(`Acción desconocida: ${action}`);
    }

    console.log(`✅ Acción ${action} completada`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error gestionando cron jobs:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

