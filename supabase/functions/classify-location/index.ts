import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Cache para ubicaciones
let ubicacionesCache: any = null;
let cacheTime = 0;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hora

async function getUbicaciones() {
  const now = Date.now();
  
  // Usar cache si está vigente
  if (ubicacionesCache && (now - cacheTime) < CACHE_DURATION) {
    return ubicacionesCache;
  }
  
  // Cargar desde Supabase
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
  
  const { data, error } = await supabase
    .from('ubicaciones_config')
    .select('contenido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error || !data) {
    console.error('Error cargando ubicaciones:', error);
    // Fallback al JSON estático si falla
    const ubicacionesData = await import("./ubicaciones.json", { with: { type: "json" } });
    return ubicacionesData.default;
  }
  
  ubicacionesCache = data.contenido;
  cacheTime = now;
  return data.contenido;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    let { titulo, descripcion } = requestBody;
    
    // Limpiar y normalizar texto para evitar problemas de encoding
    titulo = titulo?.normalize('NFC').trim() || '';
    descripcion = descripcion?.normalize('NFC').trim() || '';
    
    // Requerir al menos título O descripción
    if (!titulo && !descripcion) {
      return new Response(
        JSON.stringify({ error: 'Se requiere título o descripción' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY no configurada');
      return new Response(
        JSON.stringify({ error: 'API key no configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obtener ubicaciones desde la base de datos
    const ubicacionesData = await getUbicaciones();
    
    // Construir lista de ubicaciones válidas para el prompt
    const ubicacionesValidas = Object.entries(ubicacionesData).map(([key, data]: [string, any]) => {
      const ciudadesStr = Object.entries(data.ciudades).map(([ciudad, distritos]: [string, any]) => {
        if (distritos.length > 0) {
          return `  - ${ciudad} (distritos: ${distritos.join(', ')})`;
        }
        return `  - ${ciudad}`;
      }).join('\n');
      return `${data.provincia}:\n${ciudadesStr}`;
    }).join('\n\n');

    const systemPrompt = `Eres un experto en geografía española y clasificación de ubicaciones inmobiliarias.
Tu tarea es extraer información de ubicación de títulos y descripciones de propiedades y clasificarlas según un catálogo ESTRICTO predefinido.

UBICACIONES VÁLIDAS (USAR SOLO ESTAS):
${ubicacionesValidas}

Reglas CRÍTICAS:
1. SOLO puedes usar provincias, ciudades y distritos que aparecen en la lista de arriba
2. Debes elegir la ubicación MÁS CERCANA de la lista predefinida
3. Si una ciudad tiene distritos disponibles, intenta identificar cuál corresponde
4. Si no estás seguro del distrito, déjalo vacío (string vacío "")
5. NUNCA inventes ubicaciones que no estén en la lista
6. Si no encuentras coincidencia clara, usa la ubicación más genérica (provincia > ciudad sin distrito)

Ejemplos:
- "Piso en Malasaña, Madrid" → provincia: "Madrid", ciudad: "Madrid", distrito: "Centro"
- "Chalet en Pozuelo" → provincia: "Madrid", ciudad: "Pozuelo de Alarcón", distrito: ""
- "Apartamento en Eixample, Barcelona" → provincia: "Barcelona", ciudad: "Barcelona", distrito: "Eixample"
- "Casa en Las Rozas" → provincia: "Madrid", ciudad: "Las Rozas", distrito: ""

FORMATO DE SALIDA:
- Usa EXACTAMENTE los nombres que aparecen en la lista de ubicaciones válidas
- Si no hay distrito en la lista para esa ciudad, distrito debe ser string vacío ""
- NUNCA incluir caracteres extraños, solo texto limpio en español`;

    const userPrompt = `Analiza esta propiedad y extrae la ubicación:
${titulo ? `Título: ${titulo}` : ''}
${descripcion ? `Descripción: ${descripcion}` : ''}`;


    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extract_location',
              description: 'Extrae provincia, ciudad y distrito de una propiedad inmobiliaria',
              parameters: {
                type: 'object',
                properties: {
                  provincia: {
                    type: 'string',
                    description: 'Provincia o región española (ej: Madrid, Barcelona, Murcia)'
                  },
                  ciudad: {
                    type: 'string',
                    description: 'Municipio o ciudad (ej: Madrid, Pozuelo de Alarcón, Getafe, Cartagena). Si es Madrid Capital, usar "Madrid"'
                  },
                  distrito: {
                    type: 'string',
                    description: 'SOLO distrito AMPLIO dentro de ciudades grandes (ej: Centro, Norte, Salamanca-Retiro). Vacío si es municipio pequeño o no aplica'
                  }
                },
                required: ['provincia', 'ciudad'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extract_location' } }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error de Lovable AI:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit excedido, intenta más tarde' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos agotados, añade fondos a tu workspace' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Error al clasificar ubicación' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      console.error('No se recibió tool call de la IA');
      return new Response(
        JSON.stringify({ error: 'Respuesta inesperada de IA' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const location = JSON.parse(toolCall.function.arguments);
    
    // Normalizar y limpiar el texto de salida
    const cleanText = (text: string) => text?.normalize('NFC').trim().replace(/[^\w\sáéíóúñÁÉÍÓÚÑüÜ,.-]/g, '') || '';
    
    const result = {
      provincia: cleanText(location.provincia) || 'Desconocida',
      ciudad: cleanText(location.ciudad || location.provincia) || 'Desconocida',
      distrito: cleanText(location.distrito) || ''
    };
    
    console.log('Ubicación clasificada:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );

  } catch (error) {
    console.error('Error en classify-location:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error desconocido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
