import { authorize } from "../_shared/security.ts";
import { serve } from "../_shared/runtime.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const denied = await authorize(req, 'elevenlabs');
  if (denied) return denied;
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
    let interesReforma = false;
    let notasReforma = '';
    
    const textLower = transcriptText.toLowerCase();
    
    // Detectar nivel de interés en la visita
    if (textLower.includes('sí') || textLower.includes('si,') || textLower.includes('interesa') || textLower.includes('me gusta') || textLower.includes('visitar')) {
      nivelInteres = 'alto';
      
      // Buscar días mencionados
      const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
      diasDisponibles = dias.filter(dia => textLower.includes(dia));
      
      // Buscar horarios mencionados
      const horarios = ['mañana', 'tarde', 'noche', 'mediodía'];
      horariosDisponibles = horarios.filter(h => textLower.includes(h));
      
      // También buscar horas específicas (10:00, 11h, 5 pm, etc.)
      const horasMatch = textLower.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm|h)/gi);
      if (horasMatch) {
        horariosDisponibles.push(...horasMatch);
      }

      // Buscar fechas específicas (15 de enero, día 20, etc.)
      const fechasMatch = textLower.match(/\d{1,2}\s+de\s+\w+|\d{1,2}\/\d{1,2}/gi);
      if (fechasMatch) {
        diasDisponibles.push(...fechasMatch);
      }
    } else if (textLower.includes('quizá') || textLower.includes('tal vez') || textLower.includes('más tarde')) {
      nivelInteres = 'medio';
    } else if (textLower.includes('ahora no') || textLower.includes('otro momento')) {
      nivelInteres = 'bajo';
    }

    // Detectar interés en reforma
    if (textLower.includes('reforma') || textLower.includes('reformar')) {
      if (textLower.includes('sí') || textLower.includes('interesa') || textLower.includes('me gustaría')) {
        interesReforma = true;
        notasReforma = 'Cliente mostró interés en reforma durante la llamada';
      }
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
          interes_reforma: interesReforma,
          transcript_completo: transcript,
        },
        notas: `Interés: ${nivelInteres}. Disponibilidad: ${diasDisponibles.join(', ')} ${horariosDisponibles.join(', ')}${interesReforma ? '. Interesado en reforma' : ''}`
      })
      .eq('id', metadata.llamada_id);

    if (updateError) {
      console.error('Error actualizando llamada:', updateError);
      throw updateError;
    }

    // Obtener datos de la llamada
    const { data: llamada } = await supabase
      .from('llamadas_ia')
      .select('cliente_id, propiedad_id, propiedades!inner(portal_origen, url)')
      .eq('id', metadata.llamada_id)
      .single();

    if (!llamada) {
      console.error('No se encontró la llamada');
      return new Response(JSON.stringify({ error: 'Llamada no encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extraer los datos de la propiedad (es un objeto único, no un array)
    const propiedad = llamada.propiedades as unknown as { portal_origen: string; url: string } | null;

    // Si hay interés alto, crear visitas para cada slot mencionado
    if (nivelInteres === 'alto' && (diasDisponibles.length > 0 || horariosDisponibles.length > 0)) {
      // Crear múltiples visitas, una por cada combinación de día/horario mencionada
      const visitasCreadas = [];
      
      for (const dia of diasDisponibles.length > 0 ? diasDisponibles : ['pendiente']) {
        for (const horario of horariosDisponibles.length > 0 ? horariosDisponibles : ['pendiente']) {
          const visitaInsert = await supabase
            .from('visitas_agendadas')
            .insert({
              llamada_id: metadata.llamada_id,
              cliente_id: llamada.cliente_id,
              propiedad_id: llamada.propiedad_id,
              // Fecha tentativa - el admin confirmará
              fecha_visita: new Date(Date.now() + 86400000).toISOString().split('T')[0],
              hora_visita: '10:00',
              estado: 'pendiente_confirmacion',
              contacto_portal: propiedad?.url || '',
              notas: `Slot capturado por IA: ${dia} - ${horario}`,
            });
          
          if (!visitaInsert.error) {
            visitasCreadas.push({ dia, horario });
          }
        }
      }

      console.log(`Visitas creadas: ${visitasCreadas.length}`);
    }

    // Si hay interés en reforma, crear registro
    if (interesReforma) {
      await supabase
        .from('valoraciones_reforma')
        .insert({
          cliente_id: llamada.cliente_id,
          propiedad_id: llamada.propiedad_id,
          estado: 'interes_captado',
          coste_min: 0,
          coste_max: 0,
          valoracion_ia: {
            origen: 'llamada_ia',
            llamada_id: metadata.llamada_id,
            notas: notasReforma,
            fecha: new Date().toISOString()
          }
        });
      
      console.log('Interés en reforma registrado');
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

