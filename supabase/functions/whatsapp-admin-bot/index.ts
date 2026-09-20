import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TwilioWebhook {
  From: string;
  Body: string;
  MessageSid: string;
}

serve(async (req) => {
  const denied = await authorize(req, 'twilio');
  if (denied) return denied;
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

    // Parsear webhook de Twilio (viene como form-urlencoded)
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = (formData.get('Body') as string || '').toLowerCase().trim();
    
    console.log('📱 Mensaje recibido de:', from);
    console.log('💬 Contenido:', body);

    // Verificar que el número esté autorizado como admin
    const { data: adminConfig } = await supabase
      .from('admin_config')
      .select('*')
      .eq('telefono', from.replace('whatsapp:', ''))
      .eq('activo', true)
      .single();

    if (!adminConfig) {
      console.log('❌ Número no autorizado:', from);
      return new Response('Unauthorized', { status: 403, headers: corsHeaders });
    }

    let responseMessage = '';

    // Procesar comandos
    if (body.includes('estado') || body === 'e') {
      responseMessage = await getEstadoGeneral(supabase);
    } else if (body.includes('propiedades') || body === 'p') {
      responseMessage = await getPropiedadesStats(supabase);
    } else if (body.includes('raw') || body === 'r') {
      responseMessage = await getRawStats(supabase);
    } else if (body.includes('scrapers') || body === 's') {
      responseMessage = await getScrapersStatus(supabase);
    } else if (body.includes('costes') || body === 'c') {
      responseMessage = await getCostesAI(supabase);
    } else if (body.includes('activar') || body.includes('activate')) {
      responseMessage = await activarScraper(supabase, body);
    } else if (body.includes('desactivar') || body.includes('deactivate')) {
      responseMessage = await desactivarScraper(supabase, body);
    } else if (body.includes('listar') || body === 'l') {
      responseMessage = await listarScrapers(supabase);
    } else if (body.includes('ayuda') || body === 'h' || body === '?') {
      responseMessage = getAyuda();
    } else {
      responseMessage = `❓ Comando no reconocido: "${body}"\n\nEscribe "ayuda" para ver comandos disponibles.`;
    }

    // Enviar respuesta por WhatsApp
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const twilioAuth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_WHATSAPP_NUMBER,
        To: from,
        Body: responseMessage,
      }),
    });

    if (!twilioResponse.ok) {
      const error = await twilioResponse.text();
      console.error('❌ Error enviando mensaje Twilio:', error);
      throw new Error(`Error Twilio: ${error}`);
    }

    console.log('✅ Respuesta enviada exitosamente');

    return new Response(
      JSON.stringify({ success: true, message: 'Respuesta enviada' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error en whatsapp-admin-bot:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Funciones helper para cada comando

async function getEstadoGeneral(supabase: any): Promise<string> {
  const [propiedades, raw, scrapers, costes] = await Promise.all([
    supabase.from('propiedades').select('id', { count: 'exact', head: true }),
    supabase.from('propiedades_raw').select('id', { count: 'exact', head: true }).eq('procesado', false),
    supabase.from('scraping_triggers').select('*').eq('activo', true),
    supabase.from('ai_cost_tracking').select('*').order('fecha', { ascending: false }).limit(1).single(),
  ]);

  const activoCount = scrapers.data?.length || 0;
  const costeHoy = costes.data?.coste_acumulado_dia_usd || 0;

  return `📊 *ESTADO GENERAL*\n\n` +
    `🏠 Propiedades activas: ${propiedades.count || 0}\n` +
    `📥 Raw pendientes: ${raw.count || 0}\n` +
    `🤖 Scrapers activos: ${activoCount}\n` +
    `💰 Coste AI hoy: $${costeHoy.toFixed(2)}\n\n` +
    `Última actualización: ${new Date().toLocaleString('es-ES')}`;
}

async function getPropiedadesStats(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('propiedades')
    .select('portal_origen')
    .eq('activo', true);

  if (!data || data.length === 0) {
    return '❌ No hay propiedades activas';
  }

  const portalCounts: Record<string, number> = {};
  data.forEach((p: any) => {
    portalCounts[p.portal_origen] = (portalCounts[p.portal_origen] || 0) + 1;
  });

  let mensaje = `🏠 *PROPIEDADES ACTIVAS*\n\nTotal: ${data.length}\n\n`;
  Object.entries(portalCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([portal, count]) => {
      mensaje += `• ${portal}: ${count}\n`;
    });

  return mensaje;
}

async function getRawStats(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('propiedades_raw')
    .select('portal_origen, created_at')
    .eq('procesado', false)
    .order('created_at', { ascending: false });

  if (!data || data.length === 0) {
    return '✅ No hay propiedades raw pendientes de procesar';
  }

  const portalCounts: Record<string, number> = {};
  data.forEach((p: any) => {
    portalCounts[p.portal_origen] = (portalCounts[p.portal_origen] || 0) + 1;
  });

  const masAntigua = new Date(data[data.length - 1].created_at);
  const horasAntiguedad = Math.floor((Date.now() - masAntigua.getTime()) / (1000 * 60 * 60));

  let mensaje = `📥 *PROPIEDADES RAW PENDIENTES*\n\nTotal: ${data.length}\n\n`;
  Object.entries(portalCounts).forEach(([portal, count]) => {
    mensaje += `• ${portal}: ${count}\n`;
  });
  mensaje += `\n⏰ Más antigua: hace ${horasAntiguedad}h`;

  if (horasAntiguedad > 24) {
    mensaje += `\n\n⚠️ Hay propiedades sin procesar por más de 24h`;
  }

  return mensaje;
}

async function getScrapersStatus(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('scraping_triggers')
    .select('*')
    .order('ultima_ejecucion', { ascending: false });

  if (!data || data.length === 0) {
    return '❌ No hay scrapers configurados';
  }

  let mensaje = `🤖 *ESTADO SCRAPERS*\n\n`;

  data.forEach((scraper: any) => {
    const status = scraper.activo ? '✅' : '⏸️';
    const nombre = scraper.nombre;
    const portal = scraper.portal;
    const ubicacion = scraper.ubicacion || 'todas';
    
    let ultimaEjecucion = 'Nunca';
    if (scraper.ultima_ejecucion) {
      const fecha = new Date(scraper.ultima_ejecucion);
      const horasDesde = Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60));
      ultimaEjecucion = horasDesde === 0 ? 'Hace menos de 1h' : `Hace ${horasDesde}h`;
    }

    mensaje += `${status} *${nombre}*\n`;
    mensaje += `   ${portal} - ${ubicacion}\n`;
    mensaje += `   Última: ${ultimaEjecucion}\n\n`;
  });

  return mensaje;
}

async function getCostesAI(supabase: any): Promise<string> {
  const { data: hoy } = await supabase
    .from('ai_cost_tracking')
    .select('*')
    .eq('fecha', new Date().toISOString().split('T')[0])
    .single();

  const { data: config } = await supabase
    .from('ai_cost_config')
    .select('*')
    .single();

  const costeHoy = hoy?.coste_acumulado_dia_usd || 0;
  const umbralDiario = config?.umbral_diario_usd || 10;
  const porcentaje = (costeHoy / umbralDiario) * 100;

  let alerta = '';
  if (porcentaje > 90) {
    alerta = '\n\n🚨 ALERTA: Cerca del límite diario!';
  } else if (porcentaje > 75) {
    alerta = '\n\n⚠️ Advertencia: 75% del límite usado';
  }

  // Obtener coste mensual
  const primerDiaMes = new Date();
  primerDiaMes.setDate(1);
  const { data: dataMes } = await supabase
    .from('ai_cost_tracking')
    .select('coste_acumulado_dia_usd')
    .gte('fecha', primerDiaMes.toISOString().split('T')[0]);

  const costeMes = dataMes?.reduce((sum: number, d: any) => sum + (d.coste_acumulado_dia_usd || 0), 0) || 0;

  return `💰 *COSTES IA*\n\n` +
    `📅 Hoy: $${costeHoy.toFixed(2)} / $${umbralDiario.toFixed(2)} (${porcentaje.toFixed(0)}%)\n` +
    `📊 Mes: $${costeMes.toFixed(2)}\n` +
    `🔢 Llamadas hoy: ${hoy?.llamadas_ia_dia || 0}${alerta}`;
}

async function activarScraper(supabase: any, body: string): Promise<string> {
  // Extraer nombre del scraper del comando
  // Formato esperado: "activar [nombre]" o "activate [nombre]"
  const parts = body.split(' ');
  if (parts.length < 2) {
    return '❌ Uso: activar [nombre del scraper]\n\nEscribe "listar" para ver scrapers disponibles.';
  }

  const nombreBuscado = parts.slice(1).join(' ');

  const { data: scraper } = await supabase
    .from('scraping_triggers')
    .select('*')
    .ilike('nombre', `%${nombreBuscado}%`)
    .single();

  if (!scraper) {
    return `❌ No se encontró scraper con nombre: "${nombreBuscado}"\n\nEscribe "listar" para ver scrapers disponibles.`;
  }

  if (scraper.activo) {
    return `ℹ️ El scraper "${scraper.nombre}" ya está activo`;
  }

  const { error } = await supabase
    .from('scraping_triggers')
    .update({ activo: true })
    .eq('id', scraper.id);

  if (error) {
    console.error('Error activando scraper:', error);
    return `❌ Error activando scraper: ${error.message}`;
  }

  return `✅ Scraper "${scraper.nombre}" activado correctamente`;
}

async function desactivarScraper(supabase: any, body: string): Promise<string> {
  const parts = body.split(' ');
  if (parts.length < 2) {
    return '❌ Uso: desactivar [nombre del scraper]\n\nEscribe "listar" para ver scrapers disponibles.';
  }

  const nombreBuscado = parts.slice(1).join(' ');

  const { data: scraper } = await supabase
    .from('scraping_triggers')
    .select('*')
    .ilike('nombre', `%${nombreBuscado}%`)
    .single();

  if (!scraper) {
    return `❌ No se encontró scraper con nombre: "${nombreBuscado}"\n\nEscribe "listar" para ver scrapers disponibles.`;
  }

  if (!scraper.activo) {
    return `ℹ️ El scraper "${scraper.nombre}" ya está desactivado`;
  }

  const { error } = await supabase
    .from('scraping_triggers')
    .update({ activo: false })
    .eq('id', scraper.id);

  if (error) {
    console.error('Error desactivando scraper:', error);
    return `❌ Error desactivando scraper: ${error.message}`;
  }

  return `✅ Scraper "${scraper.nombre}" desactivado correctamente`;
}

async function listarScrapers(supabase: any): Promise<string> {
  const { data } = await supabase
    .from('scraping_triggers')
    .select('nombre, portal, ubicacion, activo')
    .order('nombre');

  if (!data || data.length === 0) {
    return '❌ No hay scrapers configurados';
  }

  let mensaje = `📋 *SCRAPERS DISPONIBLES*\n\n`;
  data.forEach((s: any, idx: number) => {
    const status = s.activo ? '✅' : '⏸️';
    mensaje += `${idx + 1}. ${status} ${s.nombre}\n`;
    mensaje += `   Portal: ${s.portal}\n`;
    mensaje += `   Ubicación: ${s.ubicacion || 'todas'}\n\n`;
  });

  mensaje += `\nPara activar/desactivar:\n`;
  mensaje += `"activar [nombre]"\n`;
  mensaje += `"desactivar [nombre]"`;

  return mensaje;
}

function getAyuda(): string {
  return `🤖 *COMANDOS DISPONIBLES*\n\n` +
    `📊 *Consultas:*\n` +
    `• estado (e) - Resumen general\n` +
    `• propiedades (p) - Stats propiedades\n` +
    `• raw (r) - Pendientes de procesar\n` +
    `• scrapers (s) - Estado scrapers\n` +
    `• costes (c) - Costes IA\n\n` +
    `⚙️ *Gestión:*\n` +
    `• listar (l) - Ver todos los scrapers\n` +
    `• activar [nombre] - Activar scraper\n` +
    `• desactivar [nombre] - Desactivar scraper\n\n` +
    `❓ *Ayuda:*\n` +
    `• ayuda (h, ?) - Este mensaje`;
}

