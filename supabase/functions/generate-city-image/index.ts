import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const denied = await authorize(req, 'admin');
  if (denied) return denied;
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ciudad, provincia } = await req.json();
    
    if (!ciudad) {
      return new Response(
        JSON.stringify({ error: 'Ciudad es requerida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY no está configurado');
    }

    const ubicacion = provincia ? `${ciudad}, ${provincia}` : ciudad;
    const prompt = `Generate a beautiful, professional cityscape photo of ${ubicacion}, Spain. The image should be high quality, panoramic view, showing the most iconic and recognizable architecture and landmarks of the city. Photorealistic style, daytime, clear sky, vibrant colors. Ultra high resolution, 16:9 aspect ratio.`;

    console.log('Generating image for:', ubicacion);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        modalities: ['image', 'text']
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      let errorMessage = 'Error al generar imagen';
      if (response.status === 402) {
        errorMessage = 'No hay créditos suficientes para generar imágenes. Por favor, añade créditos en Settings → Workspace → Usage.';
      } else if (response.status === 429) {
        errorMessage = 'Límite de peticiones excedido. Por favor, intenta de nuevo más tarde.';
      }
      
      return new Response(
        JSON.stringify({ error: errorMessage, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageUrl) {
      console.error('No se generó imagen:', data);
      return new Response(
        JSON.stringify({ error: 'No se pudo generar la imagen' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error en generate-city-image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

