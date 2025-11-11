import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ScrapingRequestSchema = z.object({
  portal: z.string().min(1).max(50),
  ubicacion: z.string().min(1).max(200).optional(),
  tipo_propiedad: z.string().min(1).max(50).optional(),
  max_pages: z.number().int().min(1).nullish(),  // Acepta null, undefined o número
});

// Schema para propiedades con raw_data (formato simplificado desde scrapers)
const PropiedadRawSchema = z.object({
  external_id: z.string(),
  portal_origen: z.string(),
  url: z.string(),
  raw_data: z.any(), // Cualquier objeto JSON
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
  propiedades: z.array(PropiedadSchema),
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
    
    // Detectar si es webhook de Python o request de trigger
    if (requestBody.propiedades && Array.isArray(requestBody.propiedades)) {
      // ===== WEBHOOK desde Python Scraper =====
      // Validar secret token en vez de JWT
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
      // No requiere autenticación (ya que verify_jwt = false en config.toml)
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

// Función para recibir datos del scraper Python (webhook)
async function handleWebhookData(supabase: any, data: z.infer<typeof WebhookDataSchema>) {
  console.log(`[Webhook] Recibiendo ${data.propiedades.length} propiedades de ${data.metadata.portal}`);
  const startTime = Date.now();

  let propiedadesNuevas = 0;
  let propiedadesActualizadas = 0;
  const errores: string[] = [];

  // NUEVO FLUJO: Guardar en propiedades_raw sin procesar (batch processing)
  for (const propiedad of data.propiedades) {
    try {
      // Type guard: verificar si es formato raw o transformado
      const isRawFormat = 'raw_data' in propiedad;
      const displayName = isRawFormat 
        ? propiedad.external_id
        : (propiedad as any).titulo?.substring(0, 50) || propiedad.external_id;
      
      console.log(`[Webhook] Guardando RAW: ${displayName}...`);

      // Verificar si ya existe en propiedades_raw
      const { data: existing } = await supabase
        .from('propiedades_raw')
        .select('id, procesado')
        .eq('external_id', propiedad.external_id)
        .eq('portal_origen', propiedad.portal_origen)
        .maybeSingle();

      const rawData = {
        external_id: propiedad.external_id,
        portal_origen: propiedad.portal_origen,
        raw_data: isRawFormat ? (propiedad as any).raw_data : propiedad, // Priorizar raw_data si existe, sino toda la propiedad
        url: propiedad.url,
        procesado: false,
        intentos_procesamiento: 0,
        error_procesamiento: null
      };

      if (existing) {
        // Si ya existe y no está procesada, actualizar raw_data
        if (!existing.procesado) {
          await supabase
            .from('propiedades_raw')
            .update({
              raw_data: propiedad,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
          propiedadesActualizadas++;
          console.log(`[Webhook] ✅ Actualizada en raw: ${propiedad.external_id}`);
        } else {
          console.log(`[Webhook] ⏭️ Ya procesada, skipping: ${propiedad.external_id}`);
        }
      } else {
        // Nueva propiedad, insertar en raw
        await supabase
          .from('propiedades_raw')
          .insert(rawData);
        propiedadesNuevas++;
        console.log(`[Webhook] ✅ Nueva en raw: ${propiedad.external_id}`);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      errores.push(`Error guardando raw ${propiedad.external_id}: ${errorMsg}`);
      console.error('[Webhook] Error guardando propiedad raw:', error);
    }
  }

  const duracionSegundos = Math.floor((Date.now() - startTime) / 1000);

  // Registrar log
  await supabase.from('scraping_logs').insert({
    portal: data.metadata.portal,
    ubicacion: data.metadata.ubicacion || null,
    propiedades_encontradas: data.metadata.total_encontradas,
    propiedades_nuevas: propiedadesNuevas,
    propiedades_actualizadas: propiedadesActualizadas,
    errores: errores.length > 0 ? errores : null,
    duracion_segundos: duracionSegundos,
    status: errores.length === 0 ? 'success' : 'partial',
  });

  console.log(`[Webhook] Guardadas en raw: ${propiedadesNuevas} nuevas, ${propiedadesActualizadas} actualizadas`);
  console.log(`[Webhook] ⚡ Usa Batch Processing para procesarlas y ahorrar 90% en costes IA`);

  return new Response(
    JSON.stringify({
      success: true,
      propiedades_guardadas_raw: data.propiedades.length,
      propiedades_nuevas: propiedadesNuevas,
      propiedades_actualizadas: propiedadesActualizadas,
      message: 'Propiedades guardadas en raw. Usa Batch Processing para procesarlas.',
      errores,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// Función para triggerar el scraper Docker
async function triggerDockerScraper(supabase: any, request: z.infer<typeof ScrapingRequestSchema>) {
  const { portal, ubicacion, tipo_propiedad, max_pages } = request;
  console.log(`[Trigger] Solicitando scraping: ${portal}${ubicacion ? ` - ${ubicacion}` : ' - Toda España'}${max_pages ? ` (max ${max_pages} páginas)` : ' (sin límite)'}`);
  const startTime = Date.now();
  
  const scraperUrl = Deno.env.get('PYTHON_SCRAPER_URL');
  
  if (!scraperUrl) {
    console.log('[Trigger] PYTHON_SCRAPER_URL no configurado. Registrando job pendiente...');
    
    // Registrar log como "pendiente" para procesamiento manual
    await supabase.from('scraping_logs').insert({
      portal,
      ubicacion: ubicacion || null,
      propiedades_encontradas: 0,
      propiedades_nuevas: 0,
      propiedades_actualizadas: 0,
      errores: ['Contenedor Docker no configurado. Configura PYTHON_SCRAPER_URL en secrets.'],
      duracion_segundos: 0,
      status: 'pending',
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Contenedor Docker no configurado',
        instructions: 'Debes configurar PYTHON_SCRAPER_URL en los secrets con la URL del contenedor Docker',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // NUEVO: Obtener IDs de propiedades existentes para scraping incremental
  console.log('[Trigger] Obteniendo IDs de propiedades existentes para scraping incremental...');
  const { data: existingProperties, error: fetchError } = await supabase
    .from("propiedades")
    .select("external_id")
    .eq("portal_origen", portal)
    .range(0, 99999); // Sin límite práctico para obtener todos los IDs

  if (fetchError) {
    console.error('[Trigger] Error obteniendo propiedades existentes:', fetchError);
  }

  const existingIds = existingProperties?.map((p: any) => p.external_id) || [];
  console.log(`[Trigger] Encontradas ${existingIds.length} propiedades existentes en BD`);

  try {
    // Triggear el scraper Python/Docker
    const response = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        portal,
        ubicacion: ubicacion || 'murcia',
        max_pages: max_pages || null,  // null = sin límite
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/scraping-service`,
        webhook_auth: Deno.env.get('SCRAPER_SECRET'),
        supabase_url: Deno.env.get('SUPABASE_URL'),
        existing_ids: existingIds,  // Pasar IDs existentes para scraping incremental
      }),
    });

    if (!response.ok) {
      throw new Error(`Error al triggear scraper: ${response.status}`);
    }

    const result = await response.json();
    
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
