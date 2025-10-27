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
      console.error('Twilio error');
      throw new Error('Failed to send WhatsApp notification');
    }

    console.log('WhatsApp notification sent successfully');

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
