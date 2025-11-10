import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { propiedad } = await req.json();
    
    if (!propiedad) {
      throw new Error('Propiedad requerida');
    }

    console.log(`[Transform] Transformando propiedad: ${propiedad.titulo?.substring(0, 50)}...`);
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no configurado');
    }

    // Cargar el JSON de ubicaciones desde la base de datos
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const ubicacionesResponse = await fetch(`${SUPABASE_URL}/rest/v1/ubicaciones_config?select=contenido&order=version.desc&limit=1`, {
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE_KEY!,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      }
    });

    let ubicacionesJson = '';
    if (ubicacionesResponse.ok) {
      const data = await ubicacionesResponse.json();
      if (data && data.length > 0) {
        ubicacionesJson = JSON.stringify(data[0].contenido);
      }
    }

    const prompt = `Eres un experto en normalización y extracción de datos inmobiliarios. Analiza el RAW completo del anuncio y extrae/normaliza TODOS los campos al modelo de datos estandarizado.

DATOS CRUDOS DEL ANUNCIO (RAW COMPLETO - ANALIZA TODO):
${JSON.stringify(propiedad, null, 2)}

${ubicacionesJson ? `UBICACIONES VÁLIDAS EN ESPAÑA:\n${ubicacionesJson}\n\n⚠️ JERARQUÍA DEL JSON: Provincia → Ciudad → Distrito (primer nivel) → Barrios (segundo nivel)\n` : ''}

REGLAS CRÍTICAS DE EXTRACACIÓN - UBICACIÓN (LA MÁS IMPORTANTE):

🔴 **JERARQUÍA OBLIGATORIA**:
   El JSON tiene 3 niveles jerárquicos que DEBES respetar:
   1. **Provincia**: Ej: "Madrid", "Barcelona", "Valencia"
   2. **Ciudad**: Ej: "Madrid", "Barcelona", "Valencia", "Murcia"
   3. **Distrito**: PRIMER nivel del JSON de cada ciudad (ej: "Salamanca", "Chamberí", "Centro")
   4. **Barrios**: SEGUNDO nivel (NO uses esto, ignóralo)

🔴 **REGLAS PARA CLASIFICAR**:
   - **provincia**: Extrae la provincia española
   - **ciudad**: Busca en el JSON la ciudad que coincida (solo incluye ciudades >50k habitantes)
   - **distrito**: SOLO el PRIMER nivel del JSON de esa ciudad
     * Para Madrid "Salamanca" → distrito: "Salamanca" ✅
     * Para Madrid "Castellana" (barrio de Salamanca) → distrito: "Salamanca" ✅ (busca el distrito padre)
     * Para Madrid "Chamberí" → distrito: "Chamberí" ✅
     * Para Madrid "Gaztambide" (barrio de Chamberí) → distrito: "Chamberí" ✅ (busca el distrito padre)
   
   - Si mencionan un BARRIO (segundo nivel), encuentra su DISTRITO padre (primer nivel)
   - Si la ciudad NO tiene distritos en el JSON → distrito: null
   - Si la ciudad tiene <300k habitantes → distrito: null

🔴 **EJEMPLOS CORRECTOS**:
   - "Castellana, Madrid" → ciudad: "Madrid", distrito: "Salamanca", provincia: "Madrid"
   - "Gaztambide, Madrid" → ciudad: "Madrid", distrito: "Chamberí", provincia: "Madrid"
   - "Chamberí, Madrid" → ciudad: "Madrid", distrito: "Chamberí", provincia: "Madrid"
   - "Barrio del Pilar, Madrid" → ciudad: "Madrid", distrito: "Fuencarral-El Pardo", provincia: "Madrid"
   - "Getafe" → ciudad: "Getafe", distrito: null, provincia: "Madrid"
   - "Centro, Murcia" → ciudad: "Murcia", distrito: "Centro", provincia: "Murcia"

1. **Tipo de Propiedad**: Normaliza a UNO de estos valores EXACTOS:
   - "piso" | "chalet" | "duplex" | "atico" | "casa" | "estudio" | "otro"

2. **Estado/Condición** (SÉ MUY ESTRICTO):
   - "obra nueva": SOLO si menciona EXPLÍCITAMENTE: "obra nueva", "new build", "estrenar", "entrega inmediata", "promoción nueva"
   - "buen estado": Si dice "buen estado", "reformado", "como nuevo", "listo para entrar"
   - "a reformar": Si dice "para reformar", "necesita reforma", "para actualizar", "antiguos"
   - null: Si NO hay información clara del estado
   
   ⚠️ IMPORTANTE: NO asumas "obra nueva" por defecto. Si no hay indicadores claros, usa null

3. **Características** (analiza título y descripción):
   - tiene_ascensor: boolean (busca: "ascensor", "lift", "elevador")
   - tiene_parking: boolean (busca: "parking", "garaje", "plaza de garaje", "garage")
   - tiene_trastero: boolean (busca: "trastero", "storage room", "cuarto trastero")
   - ano_construccion: número de 4 dígitos o null (busca: "año", "construido en", fechas)

4. **Datos numéricos**: Extrae y valida (número válido o null):
   - dormitorios (habitaciones)
   - banos (baños completos)
   - metros (metros cuadrados, m², m2)
   - precio_m2: Si falta y hay metros y precio, calcula: precio / metros

5. **Datos de contacto del anunciante** (busca en descripción o campos específicos):
   - contacto_email: Busca emails (format: xxx@xxx.xx)
   - contacto_telefono: Busca teléfonos (formatos: +34 XXX XXX XXX, XXX XXX XXX, etc.)

6. **URLs de imágenes**:
   - imagenes: Array de URLs de fotos del anuncio (mantén las que vienen o extrae si están en el raw)

CAMPOS QUE DEBES MANTENER TAL CUAL (no transformar):
- external_id
- portal_origen
- url
- titulo
- descripcion
- precio
- fecha_scraping
- fecha_publicacion

CRÍTICO:
- Lee TODO el raw antes de decidir la ubicación
- distrito solo para ciudades >300k habitantes
- Sé flexible con formatos pero estricto con normalización
- Si no encuentras un dato con certeza, usa null

Responde SOLO con un objeto JSON válido, sin markdown ni explicaciones:`;

    console.log('[Transform] Llamando a Lovable AI para transformación...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          { 
            role: 'system', 
            content: 'Eres un experto en normalización de datos inmobiliarios. Respondes SOLO con JSON válido, sin texto adicional.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Transform] Error de Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        throw new Error('Rate limit excedido en Lovable AI');
      }
      if (response.status === 402) {
        throw new Error('Créditos agotados en Lovable AI');
      }
      
      throw new Error(`Error de IA: ${response.status}`);
    }

    const aiResponse = await response.json();
    const aiContent = aiResponse.choices?.[0]?.message?.content;

    if (!aiContent) {
      throw new Error('Respuesta vacía de la IA');
    }

    console.log('[Transform] Respuesta de IA recibida');

    // Parsear JSON de la respuesta (puede venir con ```json o sin)
    let propiedadTransformada;
    try {
      const jsonMatch = aiContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) || [null, aiContent];
      const jsonText = jsonMatch[1] || aiContent;
      propiedadTransformada = JSON.parse(jsonText.trim());
    } catch (parseError) {
      console.error('[Transform] Error parseando JSON de IA:', parseError);
      console.error('[Transform] Contenido:', aiContent);
      throw new Error('Error parseando respuesta de IA');
    }

    console.log('[Transform] Propiedad transformada exitosamente');

    return new Response(
      JSON.stringify({ 
        success: true,
        propiedad: propiedadTransformada
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[Transform] Error:', error.message);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error en transformación',
        success: false
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
