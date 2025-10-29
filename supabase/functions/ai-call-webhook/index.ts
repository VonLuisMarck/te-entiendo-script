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

    const webhook = await req.json();
    console.log('Webhook recibido:', JSON.stringify(webhook, null, 2));

    // ElevenLabs envía diferentes eventos, nos interesa el de "conversation.ended"
    if (webhook.event !== 'conversation.ended') {
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { conversation_id, metadata, transcript, duration_seconds } = webhook;
    
    if (!metadata?.llamada_id) {
      console.error('No se encontró llamada_id en metadata');
      return new Response(JSON.stringify({ error: 'No llamada_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Analizar la transcripción para extraer información
    const transcriptText = transcript?.map((t: any) => `${t.role}: ${t.content}`).join('\n') || '';
    
    // Determinar el resultado de la llamada analizando la conversación
    let nivelInteres = 'ninguno';
    let diasDisponibles: string[] = [];
    let horariosDisponibles: string[] = [];
    
    const textLower = transcriptText.toLowerCase();
    
    // Detectar nivel de interés
    if (textLower.includes('sí') || textLower.includes('si,') || textLower.includes('interesa') || textLower.includes('me gusta') || textLower.includes('visitar')) {
      nivelInteres = 'alto';
      
      // Buscar días mencionados
      const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      diasDisponibles = dias.filter(dia => textLower.includes(dia));
      
      // Buscar horarios mencionados
      const horarios = ['mañana', 'tarde', 'noche'];
      horariosDisponibles = horarios.filter(h => textLower.includes(h));
      
      // También buscar horas específicas
      const horasMatch = textLower.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|h)/gi);
      if (horasMatch) {
        horariosDisponibles.push(...horasMatch);
      }
    } else if (textLower.includes('quizá') || textLower.includes('tal vez') || textLower.includes('más tarde')) {
      nivelInteres = 'medio';
    } else if (textLower.includes('ahora no') || textLower.includes('otro momento')) {
      nivelInteres = 'bajo';
    }

    // Actualizar la llamada en la BD
    const { error: updateError } = await supabase
      .from('llamadas_ia')
      .update({
        estado: 'completada',
        duracion_segundos: duration_seconds,
        transcripcion: transcriptText,
        resultado: {
          conversation_id,
          nivel_interes: nivelInteres,
          dias_disponibles: diasDisponibles,
          horarios_disponibles: horariosDisponibles,
          transcript_completo: transcript,
        }
      })
      .eq('id', metadata.llamada_id);

    if (updateError) {
      console.error('Error actualizando llamada:', updateError);
      throw updateError;
    }

    // Si hay interés alto, crear una visita agendada
    if (nivelInteres === 'alto' && (diasDisponibles.length > 0 || horariosDisponibles.length > 0)) {
      // Obtener datos de la propiedad para el contacto del portal
      const { data: llamada } = await supabase
        .from('llamadas_ia')
        .select('cliente_id, propiedad_id, propiedades(portal_origen, url)')
        .eq('id', metadata.llamada_id)
        .single();

      if (llamada) {
        // Crear visita pendiente (el admin deberá confirmar fecha/hora específica)
        await supabase
          .from('visitas_agendadas')
          .insert({
            llamada_id: metadata.llamada_id,
            cliente_id: llamada.cliente_id,
            propiedad_id: llamada.propiedad_id,
            // Por ahora ponemos fecha tentativa (mañana)
            fecha_visita: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            hora_visita: '10:00',
            estado: 'pendiente',
            contacto_portal: llamada.propiedades?.url || '',
            notas: `Disponibilidad mencionada: ${diasDisponibles.join(', ')} - ${horariosDisponibles.join(', ')}`,
          });
      }
    }

    console.log('Webhook procesado correctamente');
    return new Response(
      JSON.stringify({ 
        success: true,
        nivel_interes: nivelInteres,
        visita_creada: nivelInteres === 'alto' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error procesando webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
