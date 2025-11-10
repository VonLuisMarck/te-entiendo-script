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

    const prompt = `Eres un experto en normalización de datos inmobiliarios. Debes transformar datos crudos de propiedades de diferentes portales a un modelo de datos estandarizado.

DATOS CRUDOS DE LA PROPIEDAD:
${JSON.stringify(propiedad, null, 2)}

${ubicacionesJson ? `UBICACIONES DISPONIBLES EN ESPAÑA:\n${ubicacionesJson}\n` : ''}

TAREAS:
1. **Ubicación**: Extrae y clasifica la ubicación en:
   - ciudad (nombre normalizado de la ciudad)
   - distrito (barrio/zona si está disponible)
   - provincia (provincia española)

2. **Tipo de Propiedad**: Normaliza a uno de estos valores EXACTOS:
   - "piso"
   - "chalet" 
   - "duplex"
   - "atico"
   - "casa"
   - "estudio"
   - "otro"

3. **Condición**: Normaliza a uno de estos valores EXACTOS:
   - "obra nueva"
   - "buen estado"
   - "a reformar"
   - null (si no se puede determinar)

4. **Extracción de datos de descripción**: Analiza el texto de descripción y titulo para extraer:
   - tiene_ascensor (boolean)
   - tiene_parking (boolean)
   - ano_construccion (número de 4 dígitos o null)

5. **Cálculo precio_m2**: Si no está presente y hay metros y precio, calcula: precio / metros

6. **Validación de campos numéricos**: Asegura que estos campos sean números válidos o null:
   - dormitorios
   - banos
   - metros
   - precio_m2

IMPORTANTE: 
- Mantén external_id, portal_origen, url, titulo, descripcion, precio, imagenes, fecha_scraping, fecha_publicacion tal cual
- Solo transforma/normaliza los campos mencionados
- Si un campo no se puede determinar con certeza, usa null
- Los valores booleanos deben ser true/false, no "sí"/"no"

Responde SOLO con un objeto JSON válido con la propiedad transformada, sin explicaciones adicionales.`;

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
