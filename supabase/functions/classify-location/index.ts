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

    const systemPrompt = `Eres un experto en geografía española y clasificación de ubicaciones inmobiliarias.
Tu tarea es extraer información de ubicación de títulos y descripciones de propiedades.

Reglas CRÍTICAS:
1. Provincia: región/provincia española (Madrid, Barcelona, Murcia, etc)
2. Ciudad: municipio o ciudad oficial (Madrid, Pozuelo de Alarcón, Getafe, Alcobendas, etc)
3. Barrio: SOLO distritos o barrios DENTRO de una ciudad grande (Chamberí, Salamanca, Malasaña, Retiro, etc)

Casos especiales de la Comunidad de Madrid:
- Ciudalcampo, La Moraleja, El Soto: son urbanizaciones en San Sebastián de los Reyes
- Montealina: urbanización en Pozuelo de Alarcón
- Las Lomas, El Olivar: urbanizaciones en Boadilla del Monte
- Villafranca del Castillo: urbanización en Villanueva de la Cañada
- Si mencionan "Madrid Capital" → ciudad = "Madrid"
- Municipios metropolitanos (Pozuelo, Alcobendas, Las Rozas, Majadahonda, etc) son CIUDADES, no barrios

Formato de salida:
- Barrio vacío si es un municipio completo o urbanización
- Si es urbanización dentro de municipio, el barrio puede ser el nombre de la urbanización
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
              description: 'Extrae provincia, ciudad y barrio de una propiedad inmobiliaria',
              parameters: {
                type: 'object',
                properties: {
                  provincia: {
                    type: 'string',
                    description: 'Provincia o región española (ej: Madrid, Barcelona, Murcia)'
                  },
                  ciudad: {
                    type: 'string',
                    description: 'Municipio o ciudad (ej: Madrid, Pozuelo de Alarcón, Getafe). Si es Madrid Capital, usar "Madrid"'
                  },
                  barrio: {
                    type: 'string',
                    description: 'Barrio o distrito dentro de la ciudad. Dejar vacío si es un municipio completo o no se especifica'
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
      barrio: cleanText(location.barrio) || ''
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
