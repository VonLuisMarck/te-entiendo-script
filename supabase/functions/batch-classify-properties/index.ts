import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropiedadRaw {
  id: string;
  external_id: string;
  portal_origen: string;
  raw_data: any;
  url: string;
}

interface PropiedadProcesada {
  external_id: string;
  portal_origen: string;
  titulo: string;
  descripcion?: string;
  ubicacion: string;
  tipo_propiedad: string;
  condition?: string;
  precio: number;
  precio_m2?: number;
  metros?: number;
  dormitorios?: number;
  banos?: number;
  ano_construccion?: number;
  tiene_ascensor?: boolean;
  tiene_parking?: boolean;
  tiene_trastero?: boolean;
  contacto_email?: string;
  contacto_telefono?: string;
  imagenes?: string[];
  url: string;
  fecha_publicacion?: string;
  fecha_scraping: string;
  provincia?: string;
  ciudad?: string;
  distrito?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { batch_size = 50, max_intentos = 3 } = await req.json();
    
    console.log(`[Batch] Iniciando procesamiento batch de ${batch_size} propiedades...`);

    // 1. Obtener propiedades sin procesar
    const { data: propiedadesRaw, error: fetchError } = await supabase
      .from('propiedades_raw')
      .select('*')
      .eq('procesado', false)
      .lt('intentos_procesamiento', max_intentos)
      .order('created_at', { ascending: true })
      .limit(batch_size);

    if (fetchError) throw fetchError;
    if (!propiedadesRaw || propiedadesRaw.length === 0) {
      console.log('[Batch] No hay propiedades pendientes de procesar');
      return new Response(
        JSON.stringify({ 
          message: 'No hay propiedades pendientes',
          total: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Batch] Encontradas ${propiedadesRaw.length} propiedades para procesar`);

    // 2. Cargar ubicaciones desde DB
    const { data: ubicacionesData } = await supabase
      .from('ubicaciones_config')
      .select('contenido')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const ubicacionesJson = ubicacionesData?.contenido || {};

    // 3. Construir prompt para procesamiento batch
    const propiedadesArray = propiedadesRaw.map((p: PropiedadRaw) => ({
      id_interno: p.id,
      external_id: p.external_id,
      portal_origen: p.portal_origen,
      url: p.url,
      raw: p.raw_data
    }));

    const systemPrompt = `Eres un experto en normalización de datos inmobiliarios. 

Vas a recibir un ARRAY de ${propiedadesArray.length} propiedades. Debes procesar CADA UNA INDIVIDUALMENTE y devolver un array con los resultados.

UBICACIONES VÁLIDAS EN ESPAÑA:
${JSON.stringify(ubicacionesJson, null, 2)}

⚠️ JERARQUÍA DEL JSON: Provincia → Ciudad → Distrito (primer nivel) → Barrios (segundo nivel, NO uses)

REGLAS CRÍTICAS DE CLASIFICACIÓN:

🔴 **UBICACIÓN** (LA MÁS IMPORTANTE):
   - **provincia**: Extrae la provincia española
   - **ciudad**: Busca en el JSON la ciudad que coincida
   - **distrito**: SOLO el PRIMER nivel del JSON de esa ciudad
     * Si mencionan un BARRIO (segundo nivel), encuentra su DISTRITO padre (primer nivel)
     * Si ciudad NO tiene distritos en JSON → distrito: null
     * Si ciudad <300k habitantes → distrito: null

🔴 **EJEMPLOS**:
   - "Castellana, Madrid" → ciudad: "Madrid", distrito: "Salamanca", provincia: "Madrid"
   - "Gaztambide" → ciudad: "Madrid", distrito: "Chamberí", provincia: "Madrid"
   - "Getafe" → ciudad: "Getafe", distrito: null, provincia: "Madrid"

🔴 **TIPO PROPIEDAD**: Normaliza a: "piso" | "chalet" | "duplex" | "atico" | "casa" | "estudio" | "otro"

🔴 **CONDICIÓN**: "obra nueva" | "buen estado" | "a reformar" | null

🔴 **CARACTERÍSTICAS**:
   - tiene_ascensor: boolean o null
   - tiene_parking: boolean o null
   - tiene_trastero: boolean o null
   - ano_construccion: número 4 dígitos o null

🔴 **DATOS NUMÉRICOS** (número válido o null):
   - dormitorios, banos, metros
   - precio_m2: Si falta y hay metros y precio, calcula: precio / metros

🔴 **CONTACTO**: Busca emails y teléfonos en descripción

IMPORTANTE:
- NO inventes datos si no están
- Mantén external_id, portal_origen, url tal cual
- Si no encuentras un dato con certeza, usa null`;

    const userPrompt = `Procesa estas ${propiedadesArray.length} propiedades INDIVIDUALMENTE:

${JSON.stringify(propiedadesArray, null, 2)}

Devuelve un array JSON con EXACTAMENTE ${propiedadesArray.length} objetos, uno por cada propiedad en el mismo orden.
Cada objeto debe incluir el campo "id_interno" para identificarlo.`;

    // 4. Llamar a Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY no configurado');

    console.log('[Batch] Llamando a Lovable AI...');
    
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[Batch] Error de Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        throw new Error('Rate limit excedido en Lovable AI');
      }
      if (aiResponse.status === 402) {
        throw new Error('Créditos agotados en Lovable AI - añade fondos en Settings → Workspace → Usage');
      }
      
      throw new Error(`Error de IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('Respuesta vacía de la IA');
    }

    console.log('[Batch] Respuesta de IA recibida, parseando...');

    // 5. Parsear respuesta JSON
    let propiedadesProcesadas: PropiedadProcesada[];
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\[[\s\S]*\])\s*```/) || [null, aiContent];
      const jsonText = jsonMatch[1] || aiContent;
      propiedadesProcesadas = JSON.parse(jsonText.trim());
      
      if (!Array.isArray(propiedadesProcesadas)) {
        throw new Error('La IA no devolvió un array');
      }
    } catch (parseError) {
      console.error('[Batch] Error parseando JSON:', parseError);
      throw new Error('Error parseando respuesta de IA');
    }

    console.log(`[Batch] Procesando ${propiedadesProcesadas.length} resultados individualmente...`);

    // 6. Guardar cada propiedad INDIVIDUALMENTE con validación
    let exitosas = 0;
    let fallidas = 0;
    const errores: any[] = [];

    for (const propProcesada of propiedadesProcesadas) {
      const idInterno = (propProcesada as any).id_interno;
      const propRaw = propiedadesRaw.find((p: PropiedadRaw) => p.id === idInterno);
      
      if (!propRaw) {
        console.error(`[Batch] No se encontró propiedad raw con id_interno: ${idInterno}`);
        fallidas++;
        errores.push({ id_interno: idInterno, error: 'No encontrada en raw' });
        continue;
      }

      try {
        // Validación básica
        if (!propProcesada.titulo || !propProcesada.precio || !propProcesada.ubicacion) {
          throw new Error('Faltan campos requeridos: titulo, precio o ubicacion');
        }

        // Calcular precio_m2 si no viene
        let precio_m2 = propProcesada.precio_m2;
        if (!precio_m2 && propProcesada.precio && propProcesada.metros && propProcesada.metros > 0) {
          precio_m2 = Math.round((propProcesada.precio / propProcesada.metros) * 100) / 100;
        }

        // Preparar datos para inserción
        const propiedadFinal = {
          external_id: propRaw.external_id,
          portal_origen: propRaw.portal_origen,
          titulo: propProcesada.titulo.substring(0, 500),
          descripcion: propProcesada.descripcion?.substring(0, 2000) || null,
          ubicacion: propProcesada.ubicacion,
          tipo_propiedad: propProcesada.tipo_propiedad || 'otro',
          condition: propProcesada.condition || null,
          precio: propProcesada.precio,
          precio_m2: precio_m2 || null,
          metros: propProcesada.metros || null,
          dormitorios: propProcesada.dormitorios || null,
          banos: propProcesada.banos || null,
          ano_construccion: propProcesada.ano_construccion || null,
          tiene_ascensor: propProcesada.tiene_ascensor ?? null,
          tiene_parking: propProcesada.tiene_parking ?? null,
          tiene_trastero: propProcesada.tiene_trastero ?? null,
          contacto_email: propProcesada.contacto_email || null,
          contacto_telefono: propProcesada.contacto_telefono || null,
          imagenes: Array.isArray(propProcesada.imagenes) ? propProcesada.imagenes.slice(0, 10) : [],
          url: propRaw.url,
          fecha_publicacion: propProcesada.fecha_publicacion || null,
          fecha_scraping: new Date().toISOString(),
          provincia: propProcesada.provincia || null,
          ciudad: propProcesada.ciudad || null,
          distrito: propProcesada.distrito || null,
          activo: true,
          last_seen: new Date().toISOString()
        };

        // Guardar en propiedades con upsert
        const { error: insertError } = await supabase
          .from('propiedades')
          .upsert(propiedadFinal, {
            onConflict: 'external_id,portal_origen',
            ignoreDuplicates: false
          });

        if (insertError) throw insertError;

        // Marcar como procesado en propiedades_raw
        await supabase
          .from('propiedades_raw')
          .update({ 
            procesado: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', propRaw.id);

        exitosas++;
        console.log(`[Batch] ✅ Guardada: ${propRaw.external_id}`);

      } catch (error: any) {
        fallidas++;
        const errorMsg = error.message || 'Error desconocido';
        
        console.error(`[Batch] ❌ Error procesando ${propRaw.external_id}:`, errorMsg);
        
        errores.push({
          id_interno: idInterno,
          external_id: propRaw.external_id,
          error: errorMsg
        });

        // Incrementar contador de intentos
        await supabase
          .from('propiedades_raw')
          .update({ 
            intentos_procesamiento: propRaw.intentos_procesamiento + 1,
            error_procesamiento: errorMsg,
            updated_at: new Date().toISOString()
          })
          .eq('id', propRaw.id);
      }
    }

    // 7. Guardar log del procesamiento batch
    const duracionSegundos = Math.round((Date.now() - startTime) / 1000);
    const costeEstimado = (propiedadesRaw.length / 50) * 0.01; // Estimación: $0.01 por cada 50 propiedades

    await supabase
      .from('batch_processing_logs')
      .insert({
        total_propiedades: propiedadesRaw.length,
        propiedades_exitosas: exitosas,
        propiedades_fallidas: fallidas,
        duracion_segundos: duracionSegundos,
        coste_estimado_usd: costeEstimado,
        errores: errores.length > 0 ? errores : null
      });

    // 8. Actualizar tracking de costes en tiempo real
    const hoy = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Obtener tracking actual del día
    const { data: trackingHoy } = await supabase
      .from('ai_cost_tracking')
      .select('*')
      .eq('fecha', hoy)
      .maybeSingle();

    const nuevoCosteAcumulado = (trackingHoy?.coste_acumulado_dia_usd || 0) + costeEstimado;
    const nuevasLlamadas = (trackingHoy?.llamadas_ia_dia || 0) + 1;

    // Obtener configuración de umbrales
    const { data: config } = await supabase
      .from('ai_cost_config')
      .select('*')
      .limit(1)
      .maybeSingle();

    const umbralDiario = config?.umbral_diario_usd || 10.0;
    const umbralPorBatch = config?.umbral_por_batch_usd || 2.0;

    // Verificar si se superaron umbrales
    let alertaActiva = false;
    let alertaMensaje = '';

    if (costeEstimado > umbralPorBatch) {
      alertaActiva = true;
      alertaMensaje = `⚠️ Batch superó umbral: $${costeEstimado.toFixed(4)} > $${umbralPorBatch}`;
      console.warn(`[Batch] ${alertaMensaje}`);
    }

    if (nuevoCosteAcumulado > umbralDiario) {
      alertaActiva = true;
      alertaMensaje = alertaMensaje 
        ? `${alertaMensaje} | Coste diario superó umbral: $${nuevoCosteAcumulado.toFixed(4)} > $${umbralDiario}`
        : `⚠️ Coste diario superó umbral: $${nuevoCosteAcumulado.toFixed(4)} > $${umbralDiario}`;
      console.warn(`[Batch] Coste diario supera umbral`);
    }

    // Upsert tracking
    await supabase
      .from('ai_cost_tracking')
      .upsert({
        fecha: hoy,
        coste_acumulado_dia_usd: nuevoCosteAcumulado,
        llamadas_ia_dia: nuevasLlamadas,
        ultimo_batch_coste_usd: costeEstimado,
        ultimo_batch_timestamp: new Date().toISOString(),
        alerta_activa: alertaActiva,
        alerta_mensaje: alertaMensaje || null
      }, {
        onConflict: 'fecha'
      });

    console.log(`[Batch] Completado: ${exitosas} exitosas, ${fallidas} fallidas en ${duracionSegundos}s`);
    console.log(`[Batch] Coste: $${costeEstimado.toFixed(4)} | Acumulado día: $${nuevoCosteAcumulado.toFixed(4)}`);

    return new Response(
      JSON.stringify({
        success: true,
        total: propiedadesRaw.length,
        exitosas,
        fallidas,
        duracion_segundos: duracionSegundos,
        coste_estimado_usd: costeEstimado,
        errores: errores.length > 0 ? errores : null
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[Batch] Error general:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error en procesamiento batch',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});