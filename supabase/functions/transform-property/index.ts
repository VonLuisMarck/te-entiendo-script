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

${ubicacionesJson ? `UBICACIONES DISPONIBLES EN ESPAÑA (solo municipios >50k habitantes):\n${ubicacionesJson}\n` : ''}

REGLAS CRÍTICAS DE EXTRACCIÓN:

⚠️ **UBICACIÓN (MÁS IMPORTANTE)**:
   - DEBES analizar TODO el anuncio: título, descripcion, ubicacion, y cualquier otro campo
   - Busca menciones de ubicación en CUALQUIER parte del raw
   - Prioridad: descripcion > ubicacion > titulo
   - ciudad: Busca en el JSON la ciudad que coincida (solo >50k habitantes)
   - provincia: Extrae la provincia española
   - distrito: SOLO si ciudad >300k habitantes Y hay mención explícita (ej: "San Blas", "Chamberí")
   
   EJEMPLOS:
   - Si ves "San Blas - Madrid" → ciudad: "Madrid", distrito: "San Blas", provincia: "Madrid"
   - Si ves "Salamanca, Madrid" → ciudad: "Madrid", distrito: "Salamanca", provincia: "Madrid"
   - Si ves "Getafe" → ciudad: "Getafe", provincia: "Madrid", distrito: null
   - Si ves "Centro, Murcia" → ciudad: "Murcia", distrito: "Centro", provincia: "Murcia"

1. **Tipo de Propiedad**: Normaliza a UNO de estos valores EXACTOS:
   - "piso" | "chalet" | "duplex" | "atico" | "casa" | "estudio" | "otro"

2. **Estado/Condición**: Normaliza a UNO de estos valores EXACTOS o null:
   - "obra nueva" | "buen estado" | "a reformar" | null

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
        model: 'google/gemini-2.5-flash',
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
