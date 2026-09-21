import { authorize, cors } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ScrapingRequestSchema = z.object({
  portal: z.enum(['fotocasa', 'pisos']),
  ubicacion: z.string().trim().max(120).default(''),
  search_urls: z.array(z.string().url()).min(1).max(5),
  tipo_propiedad: z.string().min(1).max(50).optional(),
  max_pages: z.number().int().min(1).max(50).nullish(),  // Acepta null, undefined o número
});

// Schema para propiedades con raw_data (formato simplificado desde scrapers)
const PropiedadRawSchema = z.object({
  external_id: z.string(),
  portal_origen: z.string(),
  url: z.string(),
  raw_data: z.record(z.unknown()),
});

// Schema para propiedades transformadas (formato completo, legacy)
const PropiedadTransformadaSchema = z.object({
  external_id: z.string(),
  portal_origen: z.string(),
  titulo: z.string(),
  descripcion: z.string().nullable().optional(),
  precio: z.number(),
  precio_m2: z.number().nullable().optional(),
  ubicacion: z.string(),
  tipo_propiedad: z.string(),
  dormitorios: z.number().nullable().optional(),
  banos: z.number().nullable().optional(),
  metros: z.number().nullable().optional(),
  condition: z.string().nullable().optional(),
  ano_construccion: z.union([z.number(), z.string()]).nullable().optional().transform(val => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    const parsed = parseInt(val);
    return isNaN(parsed) ? null : parsed;
  }),
  tiene_ascensor: z.boolean().nullable().optional(),
  tiene_parking: z.boolean().nullable().optional(),
  url: z.string(),
  imagenes: z.array(z.string()).nullable().optional(),
  fecha_scraping: z.string().nullable().optional(),
  fecha_publicacion: z.string().nullable().optional(),
});

// Schema unión: acepta ambos formatos
const PropiedadSchema = z.union([PropiedadRawSchema, PropiedadTransformadaSchema]);

const WebhookDataSchema = z.object({
  propiedades: z.array(PropiedadSchema).min(1).max(100),
  metadata: z.object({
    portal: z.string(),
    ubicacion: z.string().nullable().optional(),
    total_encontradas: z.number(),
  }),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Detectar si es webhook de CDP o request de trigger
    if (requestBody.propiedades && Array.isArray(requestBody.propiedades)) {
      // ===== WEBHOOK desde CDP Scraper =====
      // Validar secret token en vez de JWT
      const denied = await authorize(req, 'scraper');
      if (denied) return denied;
      const scraperSecret = Deno.env.get('SCRAPER_SECRET');
      const providedSecret = req.headers.get('X-Scraper-Secret');
      
      if (!scraperSecret || providedSecret !== scraperSecret) {
        throw new Error('Unauthorized webhook');
      }
      
      const supabase = createClient(supabaseUrl, supabaseKey);
      const webhookData = WebhookDataSchema.parse(requestBody);
      return await handleWebhookData(supabase, webhookData);
      
    } else {
      // ===== REQUEST normal desde Dashboard =====
      const denied = await authorize(req, 'admin');
      if (denied) return denied;
      console.log('[Trigger] Recibiendo petición de scraping desde dashboard');
      
      // Usar service role key para operaciones de base de datos
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const scrapingRequest = ScrapingRequestSchema.parse(requestBody);
      return await triggerDockerScraper(supabase, scrapingRequest);
    }
  } catch (error: any) {
    console.error('[Scraping Service] Error:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.issues ? 'Invalid request data' : 'Failed to process scraping'
      }),
      { 
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

// Función para recibir datos del scraper CDP (webhook)
async function handleWebhookData(supabase: any, data: z.infer<typeof WebhookDataSchema>) {
  console.log(`[Webhook] Recibiendo ${data.propiedades.length} propiedades de ${data.metadata.portal}`);
  const startTime = Date.now();

  let propiedadesNuevas = 0;
  let propiedadesActualizadas = 0;
  const errores: string[] = [];

  let sinCambios = 0;
  for (const propiedad of data.propiedades) {
    try {
      if (propiedad.portal_origen !== data.metadata.portal || !['fotocasa', 'pisos'].includes(propiedad.portal_origen)) throw new Error('Portal inconsistente');
      const url = new URL(propiedad.url);
      const domain = propiedad.portal_origen === 'fotocasa' ? 'fotocasa.es' : 'pisos.com';
      if (url.protocol !== 'https:' || !(url.hostname === domain || url.hostname === `www.${domain}`) || url.username || url.password) throw new Error('URL de anuncio inválida');
      if (!propiedad.external_id.startsWith(`${propiedad.portal_origen}-`) || /-(undefined|null|None|unknown)$/.test(propiedad.external_id)) throw new Error('Identificador de anuncio inválido');
      const { data: outcome, error } = await supabase.rpc('ingest_raw_property', {
        p_external_id: propiedad.external_id, p_portal: propiedad.portal_origen, p_url: propiedad.url,
        p_raw: 'raw_data' in propiedad ? propiedad.raw_data : propiedad,
      });
      if (error) throw error;
      if (outcome === 'inserted') propiedadesNuevas++;
      else if (outcome === 'updated') propiedadesActualizadas++;
      else if (outcome === 'unchanged') sinCambios++;
      else throw new Error('Respuesta de ingesta inesperada');
    } catch (error) {
      errores.push(`Error guardando ${propiedad.external_id}: ${error instanceof Error ? error.message : 'Error de base de datos'}`);
    }
  }

  const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

  // Registrar log
  const { error: logError } = await supabase.from('scraping_logs').insert({
    portal: data.metadata.portal,
    ubicacion: data.metadata.ubicacion || null,
    propiedades_encontradas: data.metadata.total_encontradas,
    propiedades_nuevas: propiedadesNuevas,
    propiedades_actualizadas: propiedadesActualizadas,
    errores: errores.length > 0 ? errores : null,
    duracion_segundos: duracionSegundos,
    status: errores.length === 0 ? 'success' : 'partial',
  });

  if (logError) throw logError;

  console.log(`[Webhook] Guardadas en raw: ${propiedadesNuevas} nuevas, ${propiedadesActualizadas} actualizadas`);
  console.log(`[Webhook] ⚡ Usa Batch Processing para procesarlas y validar los datos de origen`);

  return new Response(
    JSON.stringify({
      success: errores.length === 0,
      propiedades_guardadas_raw: propiedadesNuevas + propiedadesActualizadas + sinCambios,
      sin_cambios: sinCambios,
      propiedades_nuevas: propiedadesNuevas,
      propiedades_actualizadas: propiedadesActualizadas,
      message: 'Propiedades guardadas en raw. Usa Batch Processing para procesarlas.',
      errores,
    }),
    { status: errores.length ? 503 : 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Función para triggerar el scraper Docker
async function triggerDockerScraper(supabase: any, request: z.infer<typeof ScrapingRequestSchema>) {
  const { portal, ubicacion, search_urls } = request;
  console.log(`[Trigger] Solicitando scraping: ${portal} - ${ubicacion} (${search_urls.length} URLs)`);
  const startTime = Date.now();
  
  const scraperUrl = Deno.env.get('BROWSER_WORKER_URL');
  
  if (!scraperUrl) {
    console.log('[Trigger] BROWSER_WORKER_URL no configurado; no se ha iniciado un job');
    
    const logged = await supabase.from('scraping_logs').insert({
      portal,
      ubicacion: ubicacion || null,
      propiedades_encontradas: 0,
      propiedades_nuevas: 0,
      propiedades_actualizadas: 0,
      errores: ['Contenedor Docker no configurado. Configura BROWSER_WORKER_URL en secrets.'],
      duracion_segundos: 0,
      status: 'error',
    });
    if (logged.error) console.error('[Trigger] Could not record missing configuration');
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Contenedor Docker no configurado',
        instructions: 'Debes configurar BROWSER_WORKER_URL en los secrets con la URL del contenedor Docker',
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const scraperApiKey = Deno.env.get('SCRAPER_API_KEY');
  if (!scraperApiKey) return Response.json({ error: 'SCRAPER_API_KEY no configurado' }, { status: 503, headers: cors });

  try {
    // Triggear el scraper CDP/Docker
    const response = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${scraperApiKey}`,
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        portal,
        ubicacion,
        source_id: portal,
        search_urls,
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al triggear scraper: ${response.status}`);
    }

    const result = await response.json();
    if (typeof result.job_id !== 'string' || !result.job_id) throw new Error('Worker did not confirm a job');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scraping iniciado en contenedor Docker',
        job_id: result.job_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Trigger] Error:', error);
    
    await supabase.from('scraping_logs').insert({
      portal,
      ubicacion: ubicacion || null,
      propiedades_encontradas: 0,
      propiedades_nuevas: 0,
      propiedades_actualizadas: 0,
      errores: [`Error al triggear scraper: ${errorMsg}`],
      duracion_segundos: 0,
      status: 'error',
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMsg,
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
}
