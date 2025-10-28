import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WhatsAppRequestSchema = z.object({
  clienteId: z.string().uuid("Invalid cliente ID"),
  matchingId: z.string().uuid("Invalid matching ID"),
  telefono: z.string().min(9).max(20).regex(/^[\d+\s-]+$/, "Invalid phone format"),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { clienteId, matchingId, telefono } = WhatsAppRequestSchema.parse(requestBody);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    const { data: clienteAuth, error: clienteError } = await supabase
      .from('clientes')
      .select('user_id')
      .eq('id', clienteId)
      .single();
    
    if (clienteError || !clienteAuth || clienteAuth.user_id !== user.id) {
      throw new Error('Unauthorized: cliente does not belong to user');
    }
    
    console.log('Enviando notificación WhatsApp para matching:', matchingId);

    // Verificar que tenemos las credenciales de Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Twilio not configured');
    }

    // Obtener los datos del matching y la propiedad
    const { data: matching, error: matchingError } = await supabase
      .from('matchings')
      .select(`
        *,
        propiedad:propiedades(*),
        cliente:clientes(nombre, tipo_suscripcion, perfil)
      `)
      .eq('id', matchingId)
      .single();

    if (matchingError || !matching) {
      throw new Error('No se pudo obtener el matching');
    }

    const propiedad = matching.propiedad;
    const cliente = matching.cliente;

    // Formatear el mensaje
    const mensaje = `🏠 *InmoFinder - Nueva Propiedad Encontrada*

Hola ${cliente.nombre}, hemos encontrado una propiedad que coincide perfectamente con tus criterios:

📍 *${propiedad.titulo}*
${propiedad.ubicacion}

💰 Precio: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(propiedad.precio)}
📏 ${propiedad.metros}m² (${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(propiedad.precio_m2)}/m²)
🛏️ ${propiedad.dormitorios} dormitorios | 🚿 ${propiedad.banos} baños

⭐ *Compatibilidad: ${Math.round(matching.score)}%*

🔗 Ver propiedad: ${propiedad.url}

_Esta propiedad acaba de ser encontrada y te la enviamos de inmediato para que no pierdas la oportunidad._`;

    // Formatear número de teléfono para WhatsApp (debe incluir código de país)
    const telefonoFormateado = telefono.startsWith('+') ? telefono : `+34${telefono}`;

    // Enviar mensaje vía Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    
    const formData = new URLSearchParams({
      From: `whatsapp:${twilioWhatsAppNumber}`,
      To: `whatsapp:${telefonoFormateado}`,
      Body: mensaje
    });

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error');
      throw new Error('Failed to send WhatsApp notification');
    }

    console.log('WhatsApp notification sent successfully');

    // Mensajes adicionales según el tier de suscripción
    if (cliente.tipo_suscripcion === 'investor' || cliente.tipo_suscripcion === 'investor_platino') {
      console.log(`Cliente ${cliente.tipo_suscripcion} detectado, enviando información adicional...`);
      
      try {
        // Obtener métricas de la zona para análisis
        const [ciudad, barrio] = propiedad.ubicacion.split(',').map((s: string) => s.trim());
        
        let metrica = null;
        if (barrio) {
          const { data } = await supabase
            .from('metricas_barrios')
            .select('*')
            .eq('ciudad', ciudad)
            .eq('barrio', barrio)
            .maybeSingle();
          metrica = data;
        }
        
        if (!metrica) {
          const { data } = await supabase
            .from('metricas_barrios')
            .select('*')
            .eq('ciudad', ciudad)
            .is('barrio', null)
            .maybeSingle();
          metrica = data;
        }

        let mensajeAdicional = '';

        if (cliente.tipo_suscripcion === 'investor') {
          // Mensaje para investor: análisis de inteligencia
          mensajeAdicional = `💼 *Análisis Investor - Real Time*

📊 *Análisis de Mercado IA*
• Score de compatibilidad: ${Math.round(matching.score)}%
${metrica ? `• Precio medio zona: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(metrica.precio_m2_medio)}/m²
• Esta propiedad: ${propiedad.precio_m2 < metrica.precio_m2_medio ? '✅ Por debajo del mercado' : '⚠️ Por encima del mercado'}
• Tendencia: ${metrica.tendencia || 'Estable'}` : ''}

🎯 *Recomendación IA*
Propiedad con alta compatibilidad para tu perfil de inversión. ${propiedad.precio_m2 < (metrica?.precio_m2_medio || propiedad.precio_m2) ? 'Oportunidad detectada por estar por debajo del precio medio.' : ''}`;

        } else if (cliente.tipo_suscripcion === 'investor_platino') {
          // Mensaje para investor platino: estimación de reforma
          const perfilMap: Record<string, string> = {
            'vivir': 'vivir en la propiedad',
            'alquilar': 'alquilar tras reforma',
            'vender': 'revender tras reforma'
          };
          const perfilTexto = perfilMap[cliente.perfil] || 'tu perfil';

          mensajeAdicional = `💎 *Servicio Investor Platino*

📊 *Análisis Completo IA*
• Score de compatibilidad: ${Math.round(matching.score)}%
${metrica ? `• Precio medio zona: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(metrica.precio_m2_medio)}/m²
• Tendencia: ${metrica.tendencia || 'Estable'}` : ''}

🏗️ *Estimación de Reforma*
Perfil detectado: *${perfilTexto}*

📸 Estamos analizando las fotos de la propiedad con IA para:
• Estimar costes de reforma según tu objetivo (${cliente.perfil})
• Identificar potencial de mejora
• Calcular ROI esperado
• Recomendar actuaciones prioritarias

📄 Recibirás un informe detallado en PDF con:
✓ Análisis visual de cada estancia
✓ Presupuesto estimado de reforma
✓ Proyección de revalorización
✓ Plan de actuación personalizado

⏱️ El informe estará listo en 15-30 minutos.`;
        }

        if (mensajeAdicional) {
          const formDataAdicional = new URLSearchParams({
            From: `whatsapp:${twilioWhatsAppNumber}`,
            To: `whatsapp:${telefonoFormateado}`,
            Body: mensajeAdicional
          });

          await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${twilioAccountSid}:${twilioAuthToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formDataAdicional.toString()
          });

          console.log(`Mensaje adicional ${cliente.tipo_suscripcion} enviado`);
        }
      } catch (additionalError) {
        console.error('Error enviando mensaje adicional:', additionalError);
        // No fallar la notificación principal por error en mensaje adicional
      }
    }

    // Actualizar el matching como notificado
    await supabase
      .from('matchings')
      .update({ notificado: true })
      .eq('id', matchingId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        message: 'Notificación enviada exitosamente'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error sending WhatsApp notification:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.issues ? 'Invalid request data' : 'Failed to send notification'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});
