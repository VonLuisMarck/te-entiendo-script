import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppNotificationRequest {
  clienteId: string;
  matchingId: string;
  telefono: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clienteId, matchingId, telefono }: WhatsAppNotificationRequest = await req.json();
    
    console.log('Enviando notificación WhatsApp:', { clienteId, matchingId, telefono });

    // Verificar que tenemos las credenciales de Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Credenciales de Twilio no configuradas');
    }

    // Crear cliente de Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obtener los datos del matching y la propiedad
    const { data: matching, error: matchingError } = await supabase
      .from('matchings')
      .select(`
        *,
        propiedad:propiedades(*),
        cliente:clientes(nombre)
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
      console.error('Error de Twilio:', twilioData);
      throw new Error(`Error de Twilio: ${twilioData.message || 'Error desconocido'}`);
    }

    console.log('Mensaje enviado exitosamente:', twilioData.sid);

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
    console.error('Error al enviar notificación WhatsApp:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Error desconocido',
        details: error.toString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
