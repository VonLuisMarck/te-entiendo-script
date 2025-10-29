import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ReportRequestSchema = z.object({
  propiedadId: z.string().uuid("Invalid propiedad ID"),
  clienteId: z.string().uuid("Invalid cliente ID"),
  telefono: z.string().min(9).max(20).regex(/^[\d+\s-]+$/, "Invalid phone format"),
  tipoReporte: z.enum(['analisis', 'presupuesto'], { required_error: "Tipo de reporte requerido" }),
});

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    const { propiedadId, clienteId, telefono, tipoReporte } = ReportRequestSchema.parse(requestBody);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    // Verificar autenticación
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw new Error('Unauthorized');
    
    // Verificar que el cliente pertenece al usuario
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('user_id, nombre, tipo_suscripcion, perfil')
      .eq('id', clienteId)
      .single();
    
    if (clienteError || !cliente || cliente.user_id !== user.id) {
      throw new Error('Unauthorized: cliente does not belong to user');
    }

    // Verificar que el cliente es premium para enviar reportes
    const isPremium = cliente.tipo_suscripcion === 'investor' || 
                      cliente.tipo_suscripcion === 'investor_platino';
    
    if (!isPremium) {
      throw new Error('Esta funcionalidad solo está disponible para clientes premium (Investor o Investor Platino)');
    }
    
    console.log(`Enviando ${tipoReporte} por WhatsApp para propiedad:`, propiedadId);

    // Verificar credenciales de Twilio
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      throw new Error('Twilio not configured');
    }

    // Obtener datos de la propiedad
    const { data: propiedad, error: propiedadError } = await supabase
      .from('propiedades')
      .select('*')
      .eq('id', propiedadId)
      .single();

    if (propiedadError || !propiedad) {
      throw new Error('No se pudo obtener la propiedad');
    }

    // Obtener matching si existe
    const { data: matching } = await supabase
      .from('matchings')
      .select('*')
      .eq('propiedad_id', propiedadId)
      .eq('cliente_id', clienteId)
      .maybeSingle();

    // Obtener métricas de la zona
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

    let mensaje = '';

    if (tipoReporte === 'analisis') {
      // Mensaje de análisis completo
      const desviacion = matching?.analisis_mercado?.desviacion_porcentaje || 0;
      const estadoMercado = desviacion <= -20 ? '🟢 CHOLLAZO' :
                           desviacion <= -10 ? '🟢 BUENA OPORTUNIDAD' :
                           desviacion <= 10 ? '🟡 PRECIO JUSTO' :
                           '🔴 SOBREVALORADO';

      mensaje = `📊 *InmoFinder - Informe de Análisis Premium*

Hola ${cliente.nombre}, aquí está el análisis completo de la propiedad:

📍 *${propiedad.titulo}*
${propiedad.ubicacion}

💰 *Datos Económicos*
Precio: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(propiedad.precio)}
Precio/m²: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(propiedad.precio_m2)}/m²

📏 *Características*
• Superficie: ${propiedad.metros}m²
• Dormitorios: ${propiedad.dormitorios || 'N/A'}
• Baños: ${propiedad.banos || 'N/A'}
${propiedad.tiene_ascensor ? '• ✅ Con ascensor' : ''}
${propiedad.tiene_parking ? '• ✅ Con parking' : ''}
${propiedad.condition ? `• Estado: ${propiedad.condition}` : ''}

${matching ? `⭐ *Score de Compatibilidad: ${Math.round(matching.score)}%*` : ''}

${metrica && matching?.analisis_mercado ? `📈 *Análisis de Mercado*
${estadoMercado}
• Precio medio zona: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(metrica.precio_m2_medio)}/m²
• Desviación: ${desviacion > 0 ? '+' : ''}${desviacion.toFixed(1)}%
${metrica.proyeccion_revalorizacion_anual ? `• Proyección anual: ${metrica.proyeccion_revalorizacion_anual > 0 ? '+' : ''}${metrica.proyeccion_revalorizacion_anual.toFixed(1)}%` : ''}
${metrica.tendencia ? `• Tendencia: ${metrica.tendencia}` : ''}` : ''}

🔗 *Ver propiedad completa:*
${propiedad.url}

💼 _Informe generado para cliente ${cliente.tipo_suscripcion === 'investor_platino' ? 'Investor Platino' : 'Investor'}_`;

    } else if (tipoReporte === 'presupuesto') {
      // Mensaje de presupuesto de reforma
      const costeM2Map: Record<string, number> = {
        vivir: 650,
        reformar: 450,
        alquilar: 550
      };
      
      const perfilNombreMap: Record<string, string> = {
        vivir: 'Vivir (Reforma Integral Premium)',
        reformar: 'Reformar (Optimizado Reventa)',
        alquilar: 'Alquilar (Durabilidad + Rentabilidad)'
      };

      const costeM2 = costeM2Map[cliente.perfil] || 550;
      const perfilNombre = perfilNombreMap[cliente.perfil] || 'Reforma Integral';
      const costeTotal = Math.round(propiedad.metros * costeM2);
      const variacion = 0.15;

      mensaje = `🏗️ *InmoFinder - Presupuesto de Reforma*

Hola ${cliente.nombre}, aquí está el presupuesto estimado para la propiedad:

📍 *${propiedad.titulo}*
${propiedad.ubicacion}

💰 *Datos de Compra*
• Precio: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(propiedad.precio)}
• Superficie: ${propiedad.metros}m²

🏗️ *Presupuesto de Reforma*
Tipo: ${perfilNombre}

💵 *Coste Estimado Total:*
*${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(costeTotal)}*

Rango: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * (1 - variacion)))} - ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * (1 + variacion)))}

📋 *Principales Partidas:*
• Demolición y Obra Gruesa: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.08))}
• Albañilería: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.20))}
• Fontanería completa: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.12))}
• Instalación eléctrica: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.10))}
• Carpintería interior: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.15))}
• Revestimientos: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.18))}
• Cocina equipada: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.10))}
• Baños completos: ${new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(costeTotal * 0.07))}

⚠️ *IMPORTANTE:*
Este es un presupuesto ORIENTATIVO. Se requiere visita presencial de arquitectos para presupuesto definitivo.

🏛️ *Arquitectura - ARQO Estudio*
Nuestro estudio asociado especializado en reformas
🌐 https://arqoestudio.com/

💼 _Presupuesto generado para cliente ${cliente.tipo_suscripcion === 'investor_platino' ? 'Investor Platino' : 'Investor'}_`;
    }

    // Formatear número de teléfono para WhatsApp
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
      console.error('Twilio error:', twilioData);
      throw new Error(`Failed to send WhatsApp: ${twilioData.message || 'Unknown error'}`);
    }

    console.log(`${tipoReporte} enviado exitosamente por WhatsApp`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioData.sid,
        message: `${tipoReporte === 'analisis' ? 'Análisis' : 'Presupuesto'} enviado exitosamente por WhatsApp`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error sending report via WhatsApp:', error.message);
    
    const status = error.message?.includes('Unauthorized') ? 403 : 
                   error.message?.includes('premium') ? 403 :
                   error.issues ? 400 : 500;
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Failed to send report',
        details: error.issues || undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status
      }
    );
  }
});
