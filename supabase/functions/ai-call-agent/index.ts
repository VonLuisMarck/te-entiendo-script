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

    // Obtener análisis de mercado y criterios del cliente
    const { data: matching } = await supabase
      .from('matchings')
      .select('analisis_mercado, score')
      .eq('cliente_id', llamada.cliente_id)
      .eq('propiedad_id', llamada.propiedad_id)
      .single();

    const { data: criterios } = await supabase
      .from('criterios_busqueda')
      .select('*')
      .eq('cliente_id', llamada.cliente_id)
      .single();

    // Crear el prompt para el agente
    const agentPrompt = `Eres un agente inmobiliario profesional y amable de InmoFinder. Tu objetivo es presentar una propiedad que coincide con los criterios del cliente.

INFORMACIÓN DE LA PROPIEDAD:
- Título: ${propiedad.titulo}
- Ubicación: ${propiedad.ubicacion}
- Precio: ${propiedad.precio.toLocaleString()}€ (${propiedad.metros ? `${(propiedad.precio/propiedad.metros).toFixed(0)}€/m²` : ''})
- Tipo: ${propiedad.tipo_propiedad}
- Dormitorios: ${propiedad.dormitorios || 'N/A'}
- Baños: ${propiedad.banos || 'N/A'}
- Superficie: ${propiedad.metros || 'N/A'}m²
- Descripción: ${propiedad.descripcion}

${matching ? `
ANÁLISIS DE MERCADO:
- Score de coincidencia: ${matching.score}/100
- Análisis: ${JSON.stringify(matching.analisis_mercado)}
` : ''}

PERFIL DEL CLIENTE:
- Nombre: ${cliente.nombre}
${criterios ? `
- Ubicaciones de interés: ${criterios.ubicaciones?.join(', ') || 'N/A'}
- Tipos de propiedad buscados: ${criterios.tipo_propiedad?.join(', ') || 'N/A'}
- Dormitorios mínimos: ${criterios.dormitorios_min || 'N/A'}
` : ''}

INSTRUCCIONES - ORDEN PRIORITARIO:
1. Saluda cordialmente y preséntate brevemente como agente de InmoFinder
2. Explica que tienes una propiedad que coincide muy bien con su búsqueda
3. Presenta los detalles más relevantes de la propiedad de forma atractiva
4. Destaca por qué esta propiedad encaja con sus criterios específicos
5. Menciona brevemente el análisis de mercado favorable si lo hay
6. **PRIORIDAD MÁXIMA**: Pregunta si está interesado en visitarla
7. **SI HAY INTERÉS**: Captura AL MENOS 2-3 opciones de disponibilidad con DÍAS Y HORARIOS ESPECÍFICOS
   - Ejemplo: "¿Te vendría bien el lunes 15 por la tarde, sobre las 18:00?" 
   - "¿Y qué tal el miércoles 17 por la mañana, tipo 11:00?"
   - Captura: DÍA + FECHA + HORA/FRANJA HORARIA específica
8. **SECUNDARIO** (solo si la conversación fluye bien y tienes tiempo): 
   - Menciona brevemente que también ofrecen servicio de reforma integral con arquitectos
   - Pregunta si sería algo de su interés para la propiedad
   - NO insistas en este punto, es opcional

IMPORTANTE:
- Prioriza SIEMPRE captar los slots de disponibilidad para la visita
- Sé conversacional, natural y profesional
- No hagas la llamada demasiado larga (máximo 3-4 minutos)
- Si no está interesado, respeta su decisión y despídete amablemente
- La reforma es OPCIONAL y SECUNDARIA, solo si hay buen ambiente

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
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
