import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_NUMBER = Deno.env.get('TWILIO_WHATSAPP_NUMBER');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_NUMBER) {
      throw new Error('Credenciales Twilio no configuradas');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    console.log('🔍 Iniciando monitoreo de scrapers y sistema...');

    const alertas: string[] = [];

    // 1. Verificar scrapers que no han corrido recientemente
    const scraperAnomalies = await checkScraperAnomalies(supabase);
    if (scraperAnomalies.length > 0) {
      alertas.push(...scraperAnomalies);
    }

    // 2. Verificar acumulación de propiedades raw
    const rawAlert = await checkRawAccumulation(supabase);
    if (rawAlert) {
      alertas.push(rawAlert);
    }

    // 3. Verificar fallos de procesado
    const processingAlert = await checkProcessingFailures(supabase);
    if (processingAlert) {
      alertas.push(processingAlert);
    }

    // 4. Verificar costes AI excedidos
    const costAlert = await checkCostThresholds(supabase);
    if (costAlert) {
      alertas.push(costAlert);
    }

    // 5. Verificar propiedades nuevas (indicador de que scrapers funcionan)
    const newPropsAlert = await checkNewProperties(supabase);
    if (newPropsAlert) {
      alertas.push(newPropsAlert);
    }

    if (alertas.length === 0) {
      console.log('✅ Todo funcionando correctamente, no hay alertas');
      return new Response(
        JSON.stringify({ success: true, message: 'Sin alertas' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar alertas a todos los admins activos
    const { data: admins } = await supabase
      .from('admin_config')
      .select('*')
      .eq('activo', true)
      .eq('recibir_alertas', true);

    if (!admins || admins.length === 0) {
      console.log('⚠️ No hay admins configurados para recibir alertas');
      return new Response(
        JSON.stringify({ success: true, message: 'Sin destinatarios' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const mensaje = `🚨 *ALERTAS INMOFINDER*\n\n${alertas.join('\n\n')}\n\n_${new Date().toLocaleString('es-ES')}_`;

    console.log(`📤 Enviando ${alertas.length} alerta(s) a ${admins.length} admin(s)`);

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const enviosPromises = admins.map(async (admin) => {
      try {
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: TWILIO_WHATSAPP_NUMBER,
            To: `whatsapp:${admin.telefono}`,
            Body: mensaje,
          }),
        });

        const enviado = response.ok;

        // Registrar en log
        await supabase.from('whatsapp_alerts_log').insert({
          tipo_alerta: 'scraper_monitoring',
          mensaje: mensaje,
          telefono_destino: admin.telefono,
          enviado_exitosamente: enviado,
          metadata: { alertas_count: alertas.length }
        });

        return { admin: admin.nombre, success: enviado };
      } catch (error) {
        console.error(`Error enviando a ${admin.nombre}:`, error);
        return { admin: admin.nombre, success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
      }
    });

    const resultados = await Promise.all(enviosPromises);
    const exitosos = resultados.filter(r => r.success).length;

    console.log(`✅ Alertas enviadas: ${exitosos}/${admins.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        alertas_detectadas: alertas.length,
        destinatarios: admins.length,
        enviados_exitosos: exitosos,
        detalles: resultados
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en whatsapp-scraper-alerts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Funciones de chequeo

async function checkScraperAnomalies(supabase: any): Promise<string[]> {
  const alertas: string[] = [];
  
  const { data: scrapers } = await supabase
    .from('scraping_triggers')
    .select('*')
    .eq('activo', true);

  if (!scrapers || scrapers.length === 0) {
    return alertas;
  }

  const ahora = Date.now();
  const HORAS_LIMITE = 6; // Alerta si un scraper activo no ha corrido en 6 horas

  for (const scraper of scrapers) {
    if (!scraper.ultima_ejecucion) {
      alertas.push(`⚠️ *${scraper.nombre}*\nNunca se ha ejecutado`);
      continue;
    }

    const ultimaEjecucion = new Date(scraper.ultima_ejecucion).getTime();
    const horasDesde = Math.floor((ahora - ultimaEjecucion) / (1000 * 60 * 60));

    if (horasDesde > HORAS_LIMITE) {
      alertas.push(`⚠️ *${scraper.nombre}*\nSin ejecutar hace ${horasDesde}h (límite: ${HORAS_LIMITE}h)`);
    }
  }

  return alertas;
}

async function checkRawAccumulation(supabase: any): Promise<string | null> {
  const UMBRAL_RAW = 100; // Alerta si hay más de 100 propiedades sin procesar

  const { count } = await supabase
    .from('propiedades_raw')
    .select('id', { count: 'exact', head: true })
    .eq('procesado', false);

  if (count && count > UMBRAL_RAW) {
    // Verificar cuánto tiempo llevan acumulándose
    const { data: masAntigua } = await supabase
      .from('propiedades_raw')
      .select('created_at')
      .eq('procesado', false)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (masAntigua) {
      const horasAntiguedad = Math.floor((Date.now() - new Date(masAntigua.created_at).getTime()) / (1000 * 60 * 60));
      return `🚨 *Acumulación de Raw*\n${count} propiedades sin procesar\nMás antigua: hace ${horasAntiguedad}h`;
    }

    return `🚨 *Acumulación de Raw*\n${count} propiedades sin procesar (umbral: ${UMBRAL_RAW})`;
  }

  return null;
}

async function checkProcessingFailures(supabase: any): Promise<string | null> {
  // Verificar logs de batch recientes con muchos fallos
  const hace2Horas = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: logs } = await supabase
    .from('batch_processing_logs')
    .select('*')
    .gte('created_at', hace2Horas)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!logs || logs.length === 0) {
    return null;
  }

  const tasaFallosAlta = logs.filter((log: any) => {
    const tasa = log.propiedades_fallidas / (log.total_propiedades || 1);
    return tasa > 0.3; // Más del 30% de fallos
  });

  if (tasaFallosAlta.length > 0) {
    const ultimoLog = tasaFallosAlta[0];
    const tasaFallos = ((ultimoLog.propiedades_fallidas / ultimoLog.total_propiedades) * 100).toFixed(0);
    return `🚨 *Fallos en Procesado*\nÚltimo batch: ${tasaFallos}% fallos (${ultimoLog.propiedades_fallidas}/${ultimoLog.total_propiedades})`;
  }

  return null;
}

async function checkCostThresholds(supabase: any): Promise<string | null> {
  const { data: hoy } = await supabase
    .from('ai_cost_tracking')
    .select('*')
    .eq('fecha', new Date().toISOString().split('T')[0])
    .single();

  const { data: config } = await supabase
    .from('ai_cost_config')
    .select('*')
    .single();

  if (!hoy || !config) {
    return null;
  }

  const costeHoy = hoy.coste_acumulado_dia_usd || 0;
  const umbral = config.umbral_diario_usd || 10;
  const porcentaje = (costeHoy / umbral) * 100;

  if (porcentaje > 100) {
    return `🚨 *Coste AI Excedido*\n$${costeHoy.toFixed(2)} / $${umbral.toFixed(2)} (${porcentaje.toFixed(0)}%)\nLímite diario superado!`;
  } else if (porcentaje > 90) {
    return `⚠️ *Coste AI Cerca del Límite*\n$${costeHoy.toFixed(2)} / $${umbral.toFixed(2)} (${porcentaje.toFixed(0)}%)`;
  }

  return null;
}

async function checkNewProperties(supabase: any): Promise<string | null> {
  // Verificar que ha habido propiedades nuevas en las últimas 12 horas
  // Si no, podría indicar que los scrapers no están funcionando
  const hace12Horas = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

  const { count } = await supabase
    .from('propiedades')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', hace12Horas);

  // Solo alertar si hay scrapers activos pero no hay propiedades nuevas
  const { data: scrapersActivos } = await supabase
    .from('scraping_triggers')
    .select('id', { count: 'exact', head: true })
    .eq('activo', true);

  if (scrapersActivos && scrapersActivos.length > 0 && (!count || count === 0)) {
    return `⚠️ *Sin Propiedades Nuevas*\nNo se han detectado propiedades nuevas en las últimas 12h\nScrapers activos: ${scrapersActivos.length}`;
  }

  return null;
}
