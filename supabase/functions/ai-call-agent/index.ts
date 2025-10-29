import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { llamadaId } = await req.json();
    
    if (!llamadaId) {
      throw new Error('llamadaId es requerido');
    }

    // Obtener datos de la llamada
    const { data: llamada, error: llamadaError } = await supabase
      .from('llamadas_ia')
      .select(`
        *,
        clientes (
          nombre,
          telefono,
          email
        ),
        propiedades (
          titulo,
          descripcion,
          ubicacion,
          precio,
          metros,
          dormitorios,
          banos,
          tipo_propiedad,
          url
        )
      `)
      .eq('id', llamadaId)
      .single();

    if (llamadaError) throw llamadaError;

    const { clientes: cliente, propiedades: propiedad } = llamada;

    // Crear el prompt para el agente
    const agentPrompt = `Eres un agente inmobiliario profesional de InmoFinder. 

Tu objetivo es llamar a ${cliente.nombre} para presentarle una propiedad excepcional que coincide con sus preferencias.

INFORMACIÓN DE LA PROPIEDAD:
- Título: ${propiedad.titulo}
- Ubicación: ${propiedad.ubicacion}
- Precio: ${propiedad.precio.toLocaleString()}€
- Metros: ${propiedad.metros}m²
- Dormitorios: ${propiedad.dormitorios}
- Baños: ${propiedad.banos}
- Tipo: ${propiedad.tipo_propiedad}
- Descripción: ${propiedad.descripcion}

INSTRUCCIONES:
1. Saluda cordialmente y preséntate como agente de InmoFinder
2. Explica que has encontrado una propiedad que coincide perfectamente con sus criterios
3. Presenta las características principales de manera atractiva
4. Destaca las VENTAJAS específicas de esta propiedad
5. Pregunta si está interesado en visitarla
6. Si dice que SÍ, pregunta su DISPONIBILIDAD (días y horarios que le vengan bien)
7. Confirma los detalles y explica que recibirá la confirmación por email

IMPORTANTE:
- Sé amable, profesional y entusiasta
- No seas demasiado insistente
- Si no está interesado, respeta su decisión
- Captura SIEMPRE el nivel de interés (alto/medio/bajo/ninguno)
- Si está interesado, captura días y horarios disponibles
- Mantén la conversación natural y fluida

URL de la propiedad: ${propiedad.url}`;

    // Crear agente en ElevenLabs
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    
    const agentResponse = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `InmoFinder - ${cliente.nombre}`,
        prompt: agentPrompt,
        first_message: `Hola ${cliente.nombre}, soy ${Math.random() > 0.5 ? 'María' : 'Carlos'} de InmoFinder. ¿Cómo estás? Te llamo porque hemos encontrado una propiedad que creo que te va a encantar.`,
        language: 'es',
        voice: {
          voice_id: Math.random() > 0.5 ? '9BWtsMINqrJLrRacOk9x' : 'CwhRBWXzGAHq8TQ4Fs17', // Aria o Roger
        },
        webhook_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-call-webhook`,
        conversation_config: {
          turn_detection: {
            threshold: 0.5,
            prefix_padding_ms: 300,
            silence_duration_ms: 1000
          }
        }
      }),
    });

    if (!agentResponse.ok) {
      const error = await agentResponse.text();
      console.error('Error creando agente:', error);
      throw new Error(`Error creando agente: ${error}`);
    }

    const agent = await agentResponse.json();

    // Iniciar llamada
    const callResponse = await fetch(`https://api.elevenlabs.io/v1/convai/agents/${agent.agent_id}/conversations`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: llamada.telefono,
        // Guardar referencia a nuestro sistema
        metadata: {
          llamada_id: llamadaId,
          cliente_id: llamada.cliente_id,
          propiedad_id: llamada.propiedad_id,
        }
      }),
    });

    if (!callResponse.ok) {
      const error = await callResponse.text();
      console.error('Error iniciando llamada:', error);
      throw new Error(`Error iniciando llamada: ${error}`);
    }

    const conversation = await callResponse.json();

    // Actualizar estado de la llamada
    await supabase
      .from('llamadas_ia')
      .update({
        estado: 'en_proceso',
        fecha_realizada: new Date().toISOString(),
        resultado: {
          agent_id: agent.agent_id,
          conversation_id: conversation.conversation_id,
        }
      })
      .eq('id', llamadaId);

    return new Response(
      JSON.stringify({
        success: true,
        agent_id: agent.agent_id,
        conversation_id: conversation.conversation_id,
        message: 'Llamada iniciada correctamente'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
